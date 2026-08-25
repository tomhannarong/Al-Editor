import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import { generateProxyDerivative } from './generator.js';
import { PROXY_DERIVATIVE_SCHEMA_VERSION, type ProxyDerivativeRevision } from '../../contracts/src/proxy-derivative.contract.js';

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
    const executor = vi.fn(async () => ({ stdout: '', stderr: '' }));
    const output = await generateProxyDerivative(revision, source, root, { executor, ffmpegPath: '/usr/bin/ffmpeg' });
    expect(pathToFileURL(output).href).toBe(revision.artifactUri);
    expect(executor).toHaveBeenCalledOnce();
    const [command, args, options] = executor.mock.calls[0]!;
    expect(command).toBe('/usr/bin/ffmpeg');
    expect(args).toContain('-nostdin');
    expect(args).toContain(source);
    expect(args).toContain('0:0');
    expect(args.at(-1)).toBe(output);
    expect(options.timeoutMs).toBe(120000);
  });

  it('fails closed when artifact URI does not match confined output', async () => {
    const { revision, source, root } = await fixture();
    revision.artifactUri = 'file:///tmp/elsewhere.mp4';
    await expect(generateProxyDerivative(revision, source, root, { executor: async () => ({ stdout: '', stderr: '' }) }))
      .rejects.toThrow('artifactUri must match the confined derivative output path');
  });
});
