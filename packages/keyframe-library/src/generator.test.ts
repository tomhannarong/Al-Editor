import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

import { extractKeyframeDerivativeFrames } from './generator.js';
import {
  KEYFRAME_DERIVATIVE_SCHEMA_VERSION,
  type KeyframeDerivativeRevision,
} from '../../contracts/src/keyframe-derivative.contract.js';
import type {
  BoundedProcessOptions,
  ProcessExecutor,
} from '../../media-catalog/src/ffprobe.js';

async function fixture(frameCount = 2): Promise<{
  revision: KeyframeDerivativeRevision;
  source: string;
  managedRoot: string;
  derivativeRoot: string;
}> {
  const root = await mkdtemp(join(tmpdir(), 'keyframe-generator-'));
  const managedRoot = join(root, 'managed');
  const derivativeRoot = join(root, 'derivatives');
  await mkdir(managedRoot, { recursive: true });
  const source = join(managedRoot, 'immutable-original.mp4');
  await writeFile(source, 'immutable-fixture');

  const revisionId = 'keyframe-rev-1';
  const revisionDirectory = createHash('sha256').update(revisionId).digest('hex');
  const frames = Array.from({ length: frameCount }, (_, index) => ({
    frameId: `kf-${index + 1}`,
    sourcePts: index * 45_000,
    artifactUri: pathToFileURL(join(derivativeRoot, revisionDirectory, `${String(index).padStart(6, '0')}.png`)).href,
  }));

  return {
    source,
    managedRoot,
    derivativeRoot,
    revision: {
      schemaVersion: KEYFRAME_DERIVATIVE_SCHEMA_VERSION,
      derivativeId: 'keyframes:scene-1',
      revisionId,
      source: {
        sceneSetId: 'scene-set-1',
        sceneSetRevisionId: 'scene-rev-1',
        sceneId: 'scene-1',
        assetId: `sha256:${'a'.repeat(64)}`,
        streamId: 'video-0',
        streamIndex: 0,
        timeBase: { numerator: 1, denominator: 90_000 },
      },
      derivativeProfileVersion: 'keyframe-png-v1',
      toolchain: { name: 'ffmpeg', version: '6.1.1' },
      createdAt: '2026-08-26T00:00:00.000Z',
      frames,
    },
  };
}

describe('extractKeyframeDerivativeFrames', () => {
  it('uses shell-free bounded FFmpeg execution with exact native sourcePts selectors', async () => {
    const { revision, source, managedRoot, derivativeRoot } = await fixture();
    const observed: Array<{ command: string; args: readonly string[]; options: BoundedProcessOptions }> = [];
    const executor: ProcessExecutor = async (command, args, options) => {
      observed.push({ command, args, options });
      const output = args.at(-1);
      if (!output) throw new Error('missing output argument');
      await writeFile(output, 'png-fixture');
      return { stdout: '', stderr: '' };
    };

    const outputs = await extractKeyframeDerivativeFrames(
      revision,
      source,
      managedRoot,
      derivativeRoot,
      { executor, ffmpegPath: '/usr/bin/ffmpeg' },
    );

    expect(outputs.map((output) => pathToFileURL(output).href)).toEqual(revision.frames.map((frame) => frame.artifactUri));
    expect(observed).toHaveLength(2);
    expect(observed[0]!.command).toBe('/usr/bin/ffmpeg');
    expect(observed[0]!.args).toContain('-copyts');
    expect(observed[0]!.args).toContain('0:0');
    expect(observed[0]!.args).toContain('select=eq(pts\\,0)');
    expect(observed[1]!.args).toContain('select=eq(pts\\,45000)');
    expect(observed[0]!.options).toEqual({
      timeoutMs: 30_000,
      maxStdoutBytes: 64 * 1024,
      maxStderrBytes: 512 * 1024,
    });
  });

  it('fails closed when a frame artifact URI does not match the confined output path', async () => {
    const { revision, source, managedRoot, derivativeRoot } = await fixture(1);
    revision.frames[0]!.artifactUri = 'file:///tmp/elsewhere.png';

    await expect(extractKeyframeDerivativeFrames(
      revision,
      source,
      managedRoot,
      derivativeRoot,
      { executor: async () => ({ stdout: '', stderr: '' }) },
    )).rejects.toThrow('artifactUri must match the confined derivative output path');
  });

  it('bounds extraction fan-out before invoking FFmpeg', async () => {
    const { revision, source, managedRoot, derivativeRoot } = await fixture(2);
    let calls = 0;
    const executor: ProcessExecutor = async () => {
      calls += 1;
      return { stdout: '', stderr: '' };
    };

    await expect(extractKeyframeDerivativeFrames(
      revision,
      source,
      managedRoot,
      derivativeRoot,
      { executor, maxFrames: 1 },
    )).rejects.toThrow('keyframe revision exceeds maxFrames 1');
    expect(calls).toBe(0);
  });
});
