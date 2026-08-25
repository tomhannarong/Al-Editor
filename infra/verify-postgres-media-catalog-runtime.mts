import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

import { PostgresMediaCatalog, type PostgresQueryClient, type PostgresQueryResult } from '../packages/media-catalog/src/postgres.ts';
import type { ValidatedImmutableIngestBundle } from '../packages/media-catalog/src/durable-ingest.ts';

const { Client } = pg;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.join(root, 'db', 'migrations');
const database = process.env.POSTGRES_DB ?? 'ai_editor';
const user = process.env.POSTGRES_USER ?? 'ai_editor';
const password = process.env.POSTGRES_PASSWORD ?? 'ai_editor_local_only';
const host = process.env.POSTGRES_HOST ?? '127.0.0.1';
const port = Number(process.env.POSTGRES_PORT ?? '5432');

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`invalid POSTGRES_PORT: ${process.env.POSTGRES_PORT ?? ''}`);
}

const client = new Client({ host, port, database, user, password });

try {
  await client.connect();

  const migrationFiles = (await readdir(migrationsDir))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
  assert(migrationFiles.includes('0002_create_media_catalog.sql'), 'migration 0002 is missing');

  for (const migrationFile of migrationFiles) {
    const sql = await readFile(path.join(migrationsDir, migrationFile), 'utf8');
    await client.query(sql);
  }

  const catalog = new PostgresMediaCatalog(client);
  const digest = 'b'.repeat(64);
  const asset = {
    schemaVersion: '1.0' as const,
    assetId: `sha256:${digest}`,
    contentDigest: { algorithm: 'sha256' as const, hex: digest },
    byteSize: 4096,
    firstIngestedAt: '2026-08-25T00:00:00.000Z',
  };

  const first = await catalog.registerAsset(asset);
  assert.equal(first.created, true);
  assert.deepEqual(first.asset, asset);

  const later = {
    ...asset,
    contentDigest: { ...asset.contentDigest },
    firstIngestedAt: '2026-08-25T05:00:00.000Z',
  };
  const second = await catalog.registerAsset(later);
  assert.equal(second.created, false);
  assert.equal(second.asset.firstIngestedAt, asset.firstIngestedAt);

  const originalLocation = {
    locationId: 'runtime-slot-1',
    assetId: asset.assetId,
    uri: 'file:///footage/original.mov',
    state: 'available' as const,
    observedAt: '2026-08-25T00:10:00.000Z',
  };
  await catalog.rebindLocation(originalLocation);
  const movedLocation = {
    ...originalLocation,
    uri: 'file:///archive/moved.mov',
    observedAt: '2026-08-25T00:20:00.000Z',
  };
  await catalog.rebindLocation(movedLocation);
  const locationReadback = await catalog.getLocation(originalLocation.locationId);
  assert(locationReadback);
  assert.equal(locationReadback.assetId, asset.assetId);
  assert.equal(locationReadback.uri, movedLocation.uri);

  const streams = [
    {
      streamId: `${asset.assetId}:stream:0`,
      assetId: asset.assetId,
      streamIndex: 0,
      kind: 'video' as const,
      codecName: 'h264',
      timeBase: { numerator: 1, denominator: 90000 },
      startPts: 180000,
      durationPts: 450000,
      width: 1920,
      height: 1080,
    },
    {
      streamId: `${asset.assetId}:stream:1`,
      assetId: asset.assetId,
      streamIndex: 1,
      kind: 'audio' as const,
      codecName: 'aac',
      timeBase: { numerator: 1, denominator: 48000 },
      startPts: 96000,
      durationPts: 240000,
      sampleRate: 48000,
      channels: 2,
    },
  ];

  await catalog.replaceStreamMetadata(asset.assetId, streams);
  const streamReadback = await catalog.getStreamMetadata(asset.assetId);
  assert.deepEqual(streamReadback, streams);

  const replacement = [{ ...streams[0]!, durationPts: 540000 }];
  await catalog.replaceStreamMetadata(asset.assetId, replacement);
  assert.deepEqual(await catalog.getStreamMetadata(asset.assetId), replacement);

  const atomicDigest = 'c'.repeat(64);
  const atomicAsset = {
    schemaVersion: '1.0' as const,
    assetId: `sha256:${atomicDigest}`,
    contentDigest: { algorithm: 'sha256' as const, hex: atomicDigest },
    byteSize: 8192,
    firstIngestedAt: '2026-08-25T06:00:00.000Z',
  };
  const atomicBundle: ValidatedImmutableIngestBundle = {
    asset: atomicAsset,
    sourceLocation: {
      locationId: 'runtime-atomic-source',
      assetId: atomicAsset.assetId,
      uri: 'file:///footage/atomic.mov',
      state: 'available',
      observedAt: '2026-08-25T06:01:00.000Z',
    },
    managedLocation: {
      locationId: 'runtime-atomic-managed',
      assetId: atomicAsset.assetId,
      uri: `file:///managed/sha256/cc/${atomicDigest}`,
      state: 'available',
      observedAt: '2026-08-25T06:02:00.000Z',
    },
    streams: [{
      streamId: `${atomicAsset.assetId}:stream:0`,
      assetId: atomicAsset.assetId,
      streamIndex: 0,
      kind: 'video',
      codecName: 'h264',
      timeBase: { numerator: 1, denominator: 90000 },
      startPts: 270000,
      durationPts: 630000,
      width: 3840,
      height: 2160,
    }],
  };

  await catalog.commitValidatedImmutableIngest(atomicBundle);
  assert.deepEqual(await catalog.getAsset(atomicAsset.assetId), atomicAsset);
  assert.deepEqual(await catalog.getLocation(atomicBundle.sourceLocation.locationId), atomicBundle.sourceLocation);
  assert.deepEqual(await catalog.getLocation(atomicBundle.managedLocation.locationId), atomicBundle.managedLocation);
  assert.deepEqual(await catalog.getStreamMetadata(atomicAsset.assetId), atomicBundle.streams);

  const rollbackDigest = 'd'.repeat(64);
  const rollbackAsset = {
    schemaVersion: '1.0' as const,
    assetId: `sha256:${rollbackDigest}`,
    contentDigest: { algorithm: 'sha256' as const, hex: rollbackDigest },
    byteSize: 16384,
    firstIngestedAt: '2026-08-25T07:00:00.000Z',
  };
  const rollbackBundle: ValidatedImmutableIngestBundle = {
    asset: rollbackAsset,
    sourceLocation: {
      locationId: 'runtime-rollback-source',
      assetId: rollbackAsset.assetId,
      uri: 'file:///footage/rollback.mov',
      state: 'available',
      observedAt: '2026-08-25T07:01:00.000Z',
    },
    managedLocation: {
      locationId: 'runtime-rollback-managed',
      assetId: rollbackAsset.assetId,
      uri: `file:///managed/sha256/dd/${rollbackDigest}`,
      state: 'available',
      observedAt: '2026-08-25T07:02:00.000Z',
    },
    streams: [{
      streamId: `${rollbackAsset.assetId}:stream:0`,
      assetId: rollbackAsset.assetId,
      streamIndex: 0,
      kind: 'audio',
      codecName: 'aac',
      timeBase: { numerator: 1, denominator: 48000 },
      startPts: 48000,
      durationPts: 96000,
      sampleRate: 48000,
      channels: 2,
    }],
  };

  let injected = false;
  const faultingClient: PostgresQueryClient = {
    async query<Row = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<PostgresQueryResult<Row>> {
      if (!injected && text.includes('INSERT INTO media_streams')) {
        injected = true;
        throw new Error('injected atomic ingest stream failure');
      }
      const result = values === undefined ? await client.query(text) : await client.query(text, [...values]);
      return { rows: result.rows as Row[], rowCount: result.rowCount };
    },
  };

  await assert.rejects(
    new PostgresMediaCatalog(faultingClient).commitValidatedImmutableIngest(rollbackBundle),
    /injected atomic ingest stream failure/,
  );
  assert.equal(injected, true);
  assert.equal((await client.query('SELECT 1 FROM media_assets WHERE asset_id = $1', [rollbackAsset.assetId])).rowCount, 0);
  assert.equal((await client.query('SELECT 1 FROM media_storage_locations WHERE location_id = ANY($1::text[])', [[rollbackBundle.sourceLocation.locationId, rollbackBundle.managedLocation.locationId]])).rowCount, 0);
  assert.equal((await client.query('SELECT 1 FROM media_streams WHERE asset_id = $1', [rollbackAsset.assetId])).rowCount, 0);

  const schemaColumns = await client.query<{ column_name: string }>(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'media_streams'
      ORDER BY column_name`,
  );
  const columnNames = schemaColumns.rows.map((row) => row.column_name);
  assert(columnNames.includes('start_pts'));
  assert(columnNames.includes('duration_pts'));
  assert(columnNames.includes('time_base_numerator'));
  assert(columnNames.includes('time_base_denominator'));
  assert(!columnNames.some((name) => /second|millisecond/i.test(name)));

  process.stdout.write('PostgreSQL media catalog runtime proof passed: migration 0002, idempotent identity, mutable rebinding, native PTS/time-base readback, and atomic validated-ingest commit/rollback.\n');
} finally {
  await client.end().catch(() => undefined);
}
