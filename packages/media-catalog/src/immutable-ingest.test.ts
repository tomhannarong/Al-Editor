import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { InMemoryMediaCatalog } from './index.js';
import { ingestImmutableLocalMedia } from './immutable-ingest.js';
import type { ProcessExecutor } from './ffprobe.js';

const cleanupRoots: string[] = [];

async function tempRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  cleanupRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(cleanupRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture() {
  const sourceRoot = await tempRoot('ai-editor-orchestrator-source-');
  const managedRoot = await tempRoot('ai-editor-orchestrator-managed-');
  const sourcePath = join(sourceRoot, 'camera.mov');
  await writeFile(sourcePath, 'immutable-orchestrator-bytes');
  return { sourceRoot, managedRoot, sourcePath };
}

function probeExecutor(calls: string[]): ProcessExecutor {
  return async (_command, args) => {
    calls.push(args.at(-1) ?? '');
    return {
      stdout: JSON.stringify({ streams: [{
        index: 0,
        codec_type: 'video',
        codec_name: 'h264',
        time_base: '1/90000',
        start_pts: '9000',
        duration_ts: '180000',
        start_time: '0.100000',
        duration: '2.000000',
      }] }),
      stderr: '',
    };
  };
}

function input(f: Awaited<ReturnType<typeof fixture>>, executor: ProcessExecutor) {
  return {
    filePath: f.sourcePath,
    allowedRoot: f.sourceRoot,
    firstIngestedAt: '2026-08-25T04:00:00.000Z',
    locationId: 'source-camera',
    observedAt: '2026-08-25T04:00:00.000Z',
    managedRoot: f.managedRoot,
    managedLocationId: 'managed-original',
    managedObservedAt: '2026-08-25T04:01:00.000Z',
    chunkSize: 4,
    ffprobe: { executor },
  };
}

describe('immutable local media ingest orchestration', () => {
  it('sequences confined registration, verified managed original, then native metadata persistence', async () => {
    const f = await fixture();
    const catalog = new InMemoryMediaCatalog();
    const probeCalls: string[] = [];

    const result = await ingestImmutableLocalMedia(input(f, probeExecutor(probeCalls)), catalog);

    expect(result.source.asset.assetId).toBe(result.managedOriginal.asset.assetId);
    expect(result.managedOriginal.location.assetId).toBe(result.source.asset.assetId);
    expect(probeCalls).toEqual([result.managedOriginal.destinationPath]);
    expect(result.streams).toEqual([expect.objectContaining({
      startPts: 9000,
      durationPts: 180000,
      timeBase: { numerator: 1, denominator: 90000 },
    })]);
    expect(catalog.getStreamMetadata(result.source.asset.assetId)).toEqual(result.streams);
  });

  it('is idempotent across repeated ingest and reuses the same content-addressed managed original', async () => {
    const f = await fixture();
    const catalog = new InMemoryMediaCatalog();
    const executor = probeExecutor([]);

    const first = await ingestImmutableLocalMedia(input(f, executor), catalog);
    const second = await ingestImmutableLocalMedia(input(f, executor), catalog);

    expect(first.source.assetCreated).toBe(true);
    expect(second.source.assetCreated).toBe(false);
    expect(first.source.asset.assetId).toBe(second.source.asset.assetId);
    expect(first.managedOriginal.created).toBe(true);
    expect(second.managedOriginal.created).toBe(false);
    expect(first.managedOriginal.destinationPath).toBe(second.managedOriginal.destinationPath);
    expect(second.streams).toEqual(first.streams);
  });

  it('does not run ffprobe or replace stream metadata when managed verification fails', async () => {
    const f = await fixture();
    const catalog = new InMemoryMediaCatalog();
    let probeCalls = 0;
    const executor: ProcessExecutor = async () => {
      probeCalls += 1;
      return { stdout: '{"streams":[]}', stderr: '' };
    };

    const first = await ingestImmutableLocalMedia(input(f, executor), catalog);
    await chmod(first.managedOriginal.destinationPath, 0o644);
    await writeFile(first.managedOriginal.destinationPath, 'corrupted-managed-original');

    await expect(ingestImmutableLocalMedia({
      ...input(f, executor),
      managedLocationId: 'managed-corrupt',
    }, catalog)).rejects.toThrow('does not match immutable asset');

    expect(probeCalls).toBe(1);
    expect(catalog.getLocation('managed-corrupt')).toBeUndefined();
    expect(catalog.getStreamMetadata(first.source.asset.assetId)).toEqual(first.streams);
  });

  it('fails closed on malformed ffprobe native timing after managed bytes are safely published', async () => {
    const f = await fixture();
    const catalog = new InMemoryMediaCatalog();
    const malformed: ProcessExecutor = async () => ({
      stdout: JSON.stringify({ streams: [{ index: 0, time_base: '0/0', start_pts: 1, duration_ts: 2 }] }),
      stderr: '',
    });

    await expect(ingestImmutableLocalMedia(input(f, malformed), catalog)).rejects.toThrow();

    const sourceLocation = catalog.getLocation('source-camera');
    const managedLocation = catalog.getLocation('managed-original');
    expect(sourceLocation).toBeDefined();
    expect(managedLocation).toBeDefined();
    expect(managedLocation?.assetId).toBe(sourceLocation?.assetId);
    expect(catalog.getStreamMetadata(sourceLocation!.assetId)).toEqual([]);
  });
});
