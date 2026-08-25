import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';

import { ingestImmutableLocalMediaDurably } from '../packages/media-catalog/src/durable-ingest.ts';
import { runBoundedProcess } from '../packages/media-catalog/src/ffprobe.ts';
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

  const sourcePath = path.join(sourceRoot, 'camera-runtime.mp4');
  await runBoundedProcess('ffmpeg', [
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    '-f', 'lavfi',
    '-i', 'testsrc=size=320x240:rate=25:duration=2',
    '-f', 'lavfi',
    '-i', 'sine=frequency=1000:sample_rate=48000:duration=2',
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-c:v', 'mpeg4',
    '-q:v', '5',
    '-c:a', 'aac',
    '-shortest',
    sourcePath,
  ], {
    timeoutMs: 20_000,
    maxStdoutBytes: 256 * 1024,
    maxStderrBytes: 1024 * 1024,
  });

  const sourceBytes = await readFile(sourcePath);
  assert(sourceBytes.byteLength > 0, 'generated real-media fixture must contain bytes');

  const catalog = new PostgresMediaCatalog(client);
  const ingestInput = {
    filePath: sourcePath,
    allowedRoot: sourceRoot,
    firstIngestedAt: '2026-08-25T08:30:00.000Z',
    locationId: 'runtime-durable-source',
    observedAt: '2026-08-25T08:31:00.000Z',
    managedRoot,
    managedLocationId: 'runtime-durable-managed',
    managedObservedAt: '2026-08-25T08:32:00.000Z',
    chunkSize: 64 * 1024,
    ffprobe: {
      timeoutMs: 15_000,
      maxStdoutBytes: 8 * 1024 * 1024,
      maxStderrBytes: 256 * 1024,
    },
  };

  const first = await ingestImmutableLocalMediaDurably(ingestInput, catalog);
  assert.equal(first.source.assetCreated, true);
  assert.equal(first.managedOriginal.created, true);
  assert.deepEqual(await readFile(first.managedOriginal.destinationPath), sourceBytes);
  assert.deepEqual(await catalog.getAsset(first.source.asset.assetId), first.source.asset);
  assert.deepEqual(await catalog.getLocation(ingestInput.locationId), first.source.location);
  assert.deepEqual(await catalog.getLocation(ingestInput.managedLocationId), first.managedOriginal.location);
  assert.deepEqual(await catalog.getStreamMetadata(first.source.asset.assetId), first.streams);

  const video = first.streams.find((stream) => stream.kind === 'video');
  const audio = first.streams.find((stream) => stream.kind === 'audio');
  assert(video, 'real ffprobe must return a video stream');
  assert(audio, 'real ffprobe must return an audio stream');
  assert.equal(video.codecName, 'mpeg4');
  assert.equal(audio.codecName, 'aac');
  assert(video.timeBase.numerator > 0 && video.timeBase.denominator > 0);
  assert(audio.timeBase.numerator > 0 && audio.timeBase.denominator > 0);
  assert.notDeepEqual(video.timeBase, audio.timeBase, 'real video/audio streams should retain their own native time bases');
  assert(video.durationPts !== null && video.durationPts > 0);
  assert(audio.durationPts !== null && audio.durationPts > 0);
  assert(video.startPts === null || Number.isSafeInteger(video.startPts));
  assert(audio.startPts === null || Number.isSafeInteger(audio.startPts));

  const second = await ingestImmutableLocalMediaDurably(ingestInput, catalog);
  assert.equal(second.managedOriginal.created, false, 'verified managed content must be reused on idempotent re-ingest');
  assert.equal(second.source.asset.assetId, first.source.asset.assetId);
  assert.equal(second.managedOriginal.destinationPath, first.managedOriginal.destinationPath);
  assert.deepEqual(second.streams, first.streams, 'real ffprobe normalization must be deterministic for unchanged media bytes');

  const assetCount = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM media_assets WHERE asset_id = $1', [first.source.asset.assetId]);
  const locationCount = await client.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM media_storage_locations WHERE location_id = ANY($1::text[])',
    [[ingestInput.locationId, ingestInput.managedLocationId]],
  );
  const streamCount = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM media_streams WHERE asset_id = $1', [first.source.asset.assetId]);
  assert.equal(assetCount.rows[0]?.count, '1');
  assert.equal(locationCount.rows[0]?.count, '2');
  assert.equal(streamCount.rows[0]?.count, String(first.streams.length));

  process.stdout.write('Durable immutable local ingest real-media proof passed: generated FFmpeg fixture, confined source hashing, verified content-addressed managed original, real ffprobe native stream metadata, atomic PostgreSQL commit, and idempotent re-ingest.\n');
} finally {
  await client.end().catch(() => undefined);
  await rm(tempRoot, { recursive: true, force: true });
}
