import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ingestImmutableLocalMediaDurably,
  type DurableImmutableIngestPersistence,
  type ValidatedImmutableIngestBundle,
} from './durable-ingest.js';
import type { ProcessExecutor } from './ffprobe.js';

const cleanupRoots: string[] = [];

afterEach(async () => {
  await Promise.all(cleanupRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture() {
  const sourceRoot = await mkdtemp(join(tmpdir(), 'ai-editor-durable-source-'));
  const managedRoot = await mkdtemp(join(tmpdir(), 'ai-editor-durable-managed-'));
  cleanupRoots.push(sourceRoot, managedRoot);
  const sourcePath = join(sourceRoot, 'clip.mov');
  await writeFile(sourcePath, 'durable-immutable-ingest-bytes');
  return { sourceRoot, managedRoot, sourcePath };
}

function validExecutor(): ProcessExecutor {
  return async () => ({
    stdout: JSON.stringify({
      streams: [{
        index: 0,
        codec_type: 'video',
        codec_name: 'h264',
        time_base: '1/90000',
        start_pts: '9000',
        duration_ts: '180000',
        width: 1920,
        height: 1080,
      }],
    }),
    stderr: '',
  });
}

function input(f: Awaited<ReturnType<typeof fixture>>, executor: ProcessExecutor) {
  return {
    filePath: f.sourcePath,
    allowedRoot: f.sourceRoot,
    firstIngestedAt: '2026-08-25T04:00:00.000Z',
    locationId: 'source-card',
    observedAt: '2026-08-25T04:00:00.000Z',
    managedRoot: f.managedRoot,
    managedLocationId: 'managed-original',
    managedObservedAt: '2026-08-25T04:00:01.000Z',
    chunkSize: 4,
    ffprobe: { executor },
  };
}

describe('durable immutable ingest staging boundary', () => {
  it('commits one validated aggregate only after all deterministic media validation succeeds', async () => {
    const f = await fixture();
    const committed: ValidatedImmutableIngestBundle[] = [];
    const persistence: DurableImmutableIngestPersistence = {
      commitValidatedImmutableIngest: vi.fn(async (bundle) => {
        committed.push(bundle);
      }),
    };

    const result = await ingestImmutableLocalMediaDurably(input(f, validExecutor()), persistence);

    expect(persistence.commitValidatedImmutableIngest).toHaveBeenCalledTimes(1);
    expect(committed).toHaveLength(1);
    expect(committed[0]!.asset.assetId).toBe(result.source.asset.assetId);
    expect(committed[0]!.sourceLocation.locationId).toBe('source-card');
    expect(committed[0]!.managedLocation.locationId).toBe('managed-original');
    expect(committed[0]!.streams).toEqual([expect.objectContaining({
      startPts: 9000,
      durationPts: 180000,
      timeBase: { numerator: 1, denominator: 90000 },
    })]);
  });

  it('never invokes durable persistence when ffprobe/native timing validation fails', async () => {
    const f = await fixture();
    const persistence: DurableImmutableIngestPersistence = {
      commitValidatedImmutableIngest: vi.fn(async () => undefined),
    };
    const malformed: ProcessExecutor = async () => ({
      stdout: JSON.stringify({ streams: [{ index: 0, time_base: '0/0', start_pts: 1, duration_ts: 2 }] }),
      stderr: '',
    });

    await expect(ingestImmutableLocalMediaDurably(input(f, malformed), persistence)).rejects.toThrow();
    expect(persistence.commitValidatedImmutableIngest).not.toHaveBeenCalled();
  });

  it('hands durable persistence defensive aggregate copies', async () => {
    const f = await fixture();
    let captured: ValidatedImmutableIngestBundle | undefined;
    const persistence: DurableImmutableIngestPersistence = {
      commitValidatedImmutableIngest: async (bundle) => {
        captured = bundle;
        bundle.asset.contentDigest.hex = '0'.repeat(64);
        bundle.streams[0]!.timeBase.denominator = 1;
      },
    };

    const result = await ingestImmutableLocalMediaDurably(input(f, validExecutor()), persistence);

    expect(captured).toBeDefined();
    expect(result.source.asset.contentDigest.hex).not.toBe('0'.repeat(64));
    expect(result.streams[0]!.timeBase.denominator).toBe(90000);
  });
});
