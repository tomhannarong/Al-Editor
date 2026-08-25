import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

import { generateProxyDerivative } from './generator.js';
import { PROXY_DERIVATIVE_SCHEMA_VERSION, type ProxyDerivativeRevision } from '../../contracts/src/proxy-derivative.contract.js';
import type { BoundedProcessOptions, ProcessExecutor } from '../../media-catalog/src/ffprobe.js';

async function fixture(): Promise<{ revision: ProxyDerivativeRevision; source: string; root: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'proxy-generator-'));
  const source = join(dir, 'managed-original.mp4');
  const root = join(dir, 'derivatives');
  await writeFile(source, 'immutable-fixture');
  const revisionId = 'proxy-rev-1';
  return {
    source,
    root,
    revision: {
      schemaVersion: PROXY_DERIVATIVE_SCHEMA_VERSION,
      derivativeId: 'proxy-1',
      revisionId,
      source: {
        sceneSetId: 'scene-set-1', sceneSetRevisionId: 'scene-rev-1',
        assetId: `sha256:${'a'.repeat(64)}`, streamId: 'video-0', streamIndex: 0,
        timeBase: { numerator: 1, denominator: 90000 },
      },
      derivativeProfileVersion: 'proxy-h264-720p-v1',
      toolchain: { name: 'ffmpeg', version: '6.1.1' },
      artifactUri: pathToFileURL(join(root, `${revisionId}.mp4`)).href,
      createdAt: '2026-08-25T00:00:00.000Z',
    },
  };
}

describe('generateProxyDerivative', () => {
  it('uses shell-free bounded executor with deterministic proxy arguments', async () => {
    const { revision, source, root } = await fixture();
    let observed: { command: string; args: readonly string[]; options: BoundedProcessOptions } | undefined;
    const executor: ProcessExecutor = async (command, args, options) => {
      observed = { command, args, options };
      return { stdout: '', stderr: '' };
    };
    const output = await generateProxyDerivative(revision, source, root, { executor, ffmpegPath: '/usr/bin/ffmpeg' });
    expect(pathToFileURL(output).href).toBe(revision.artifactUri);
    expect(observed).toBeDefined();
    expect(observed!.command).toBe('/usr/bin/ffmpeg');
    expect(observed!.args).toContain('-nostdin');
    expect(observed!.args).toContain(source);
    expect(observed!.args).toContain('0:0');
    expect(observed!.args.at(-1)).toBe(output);
    expect(observed!.options.timeoutMs).toBe(120000);
  });

  it('fails closed when artifact URI does not match confined output', async () => {
    const { revision, source, root } = await fixture();
    revision.artifactUri = 'file:///tmp/elsewhere.mp4';
    await expect(generateProxyDerivative(revision, source, root, { executor: async () => ({ stdout: '', stderr: '' }) }))
      .rejects.toThrow('artifactUri must match the confined derivative output path');
  });
});
