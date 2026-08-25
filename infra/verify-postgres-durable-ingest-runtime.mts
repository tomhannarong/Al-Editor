import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';

import { ingestImmutableLocalMediaDurably } from '../packages/media-catalog/src/durable-ingest.ts';
import type { ProcessExecutor } from '../packages/media-catalog/src/ffprobe.ts';
import { PostgresMediaCatalog } from '../packages/media-catalog/src/postgres.ts';

const { Client } = pg;
const database = process.env.POSTGRES_DB ?? 'ai_editor';
const user = process.env.POSTGRES_USER ?? 'ai_editor';
const password = process.env.POSTGRES_PASSWORD ?? 'ai_editor_local_only';
const host = process.env.POSTGRES_HOST ?? '127.0.0.1';
const port = Number(process.env.POSTGRES_PORT ?? '5432');

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`invalid POSTGRES_PORT: ${process.env.POSTGRES_PORT ?? ''}`);
}

const client = new Client({ host, port, database, user, password });
const tempRoot = await mkdtemp(path.join(tmpdir(), 'ai-editor-durable-ingest-'));

try {
  await client.connect();

  const sourceRoot = path.join(tempRoot, 'source');
  const managedRoot = path.join(tempRoot, 'managed');
  await mkdir(sourceRoot, { recursive: true });
  await mkdir(managedRoot, { recursive: true });

  const sourcePath = path.join(sourceRoot, 'camera-runtime.mov');
  const sourceBytes = Buffer.from('ai-editor-postgres-durable-ingest-runtime-fixture-v1');
  await writeFile(sourcePath, sourceBytes);

  let probeCalls = 0;
  const executor: ProcessExecutor = async (command, args) => {
    probeCalls += 1;
    assert.equal(command, 'ffprobe');
    assert.deepEqual(args.slice(0, 6), ['-v', 'error', '-show_streams', '-of', 'json', '-i']);
    const mediaPath = args[6];
    assert.equal(typeof mediaPath, 'string');
    assert(mediaPath?.startsWith(managedRoot), 'ffprobe must inspect the verified managed original');

    return {
      stdout: JSON.stringify({
        streams: [
          {
            index: 0,
            codec_type: 'video',
            codec_name: 'h264',
            time_base: '1/90000',
            start_pts: '180000',
            duration_ts: '450000',
            start_time: '2.000000',
            duration: '5.000000',
            width: 1920,
            height: 1080,
          },
          {
            index: 1,
            codec_type: 'audio',
            codec_name: 'aac',
            time_base: '1/48000',
            start_pts: '96000',
            duration_ts: '240000',
            sample_rate: '48000',
            channels: 2,
          },
        ],
      }),
      stderr: '',
    };
  };

  const catalog = new PostgresMediaCatalog(client);
  const ingestInput = {
    filePath: sourcePath,
    allowedRoot: sourceRoot,
    firstIngestedAt: '2026-08-25T07:00:00.000Z',
    locationId: 'runtime-durable-source',
    observedAt: '2026-08-25T07:01:00.000Z',
    managedRoot,
    managedLocationId: 'runtime-durable-managed',
    managedObservedAt: '2026-08-25T07:02:00.000Z',
    chunkSize: 7,
    ffprobe: { executor },
  };

  const first = await ingestImmutableLocalMediaDurably(ingestInput, catalog);
  assert.equal(probeCalls, 1);
  assert.equal(first.source.assetCreated, true);
  assert.equal(first.managedOriginal.created, true);
  assert.deepEqual(await readFile(first.managedOriginal.destinationPath), sourceBytes);
  assert.deepEqual(await catalog.getAsset(first.source.asset.assetId), first.source.asset);
  assert.deepEqual(await catalog.getLocation(ingestInput.locationId), first.source.location);
  assert.deepEqual(await catalog.getLocation(ingestInput.managedLocationId), first.managedOriginal.location);
  assert.deepEqual(await catalog.getStreamMetadata(first.source.asset.assetId), first.streams);
  assert.deepEqual(first.streams.map((stream) => ({
    index: stream.streamIndex,
    startPts: stream.startPts,
    durationPts: stream.durationPts,
    timeBase: stream.timeBase,
  })), [
    { index: 0, startPts: 180000, durationPts: 450000, timeBase: { numerator: 1, denominator: 90000 } },
    { index: 1, startPts: 96000, durationPts: 240000, timeBase: { numerator: 1, denominator: 48000 } },
  ]);

  const second = await ingestImmutableLocalMediaDurably(ingestInput, catalog);
  assert.equal(probeCalls, 2);
  assert.equal(second.managedOriginal.created, false, 'verified managed content must be reused on idempotent re-ingest');
  assert.equal(second.source.asset.assetId, first.source.asset.assetId);
  assert.equal(second.managedOriginal.destinationPath, first.managedOriginal.destinationPath);

  const assetCount = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM media_assets WHERE asset_id = $1', [first.source.asset.assetId]);
  const locationCount = await client.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM media_storage_locations WHERE location_id = ANY($1::text[])',
    [[ingestInput.locationId, ingestInput.managedLocationId]],
  );
  const streamCount = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM media_streams WHERE asset_id = $1', [first.source.asset.assetId]);
  assert.equal(assetCount.rows[0]?.count, '1');
  assert.equal(locationCount.rows[0]?.count, '2');
  assert.equal(streamCount.rows[0]?.count, '2');

  process.stdout.write('Durable immutable local ingest runtime proof passed: confined filesystem source, verified content-addressed managed original, normalized native PTS/time-base metadata, atomic PostgreSQL commit, and idempotent re-ingest.\n');
} finally {
  await client.end().catch(() => undefined);
  await rm(tempRoot, { recursive: true, force: true });
}
