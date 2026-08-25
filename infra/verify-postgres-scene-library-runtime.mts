import assert from 'node:assert/strict';
import pg from 'pg';

import { PostgresMediaCatalog } from '../packages/media-catalog/src/postgres.ts';
import { PostgresSceneSetRevisionStore } from '../packages/scene-library/src/postgres.ts';
import type { SceneSetRevision } from '../packages/contracts/src/scene-set.contract.ts';

const { Client } = pg;
const client = new Client({
  host: process.env.POSTGRES_HOST ?? '127.0.0.1',
  port: Number(process.env.POSTGRES_PORT ?? '5432'),
  database: process.env.POSTGRES_DB ?? 'ai_editor',
  user: process.env.POSTGRES_USER ?? 'ai_editor',
  password: process.env.POSTGRES_PASSWORD ?? 'ai_editor_local_only',
});

try {
  await client.connect();

  const schemaCheck = await client.query<{ scene_set_revisions: string | null; scene_set_intervals: string | null }>(
    `SELECT to_regclass('public.scene_set_revisions')::text AS scene_set_revisions,
            to_regclass('public.scene_set_intervals')::text AS scene_set_intervals`,
  );
  assert.equal(schemaCheck.rows[0]?.scene_set_revisions, 'scene_set_revisions', 'migration 0003 scene_set_revisions is not applied');
  assert.equal(schemaCheck.rows[0]?.scene_set_intervals, 'scene_set_intervals', 'migration 0003 scene_set_intervals is not applied');

  const digest = 'e'.repeat(64);
  const assetId = `sha256:${digest}`;
  const streamId = `${assetId}:stream:0`;
  const catalog = new PostgresMediaCatalog(client);
  await catalog.registerAsset({
    schemaVersion: '1.0',
    assetId,
    contentDigest: { algorithm: 'sha256', hex: digest },
    byteSize: 2048,
    firstIngestedAt: '2026-08-25T13:00:00.000Z',
  });
  await catalog.replaceStreamMetadata(assetId, [{
    streamId,
    assetId,
    streamIndex: 0,
    kind: 'video',
    codecName: 'h264',
    timeBase: { numerator: 1, denominator: 90000 },
    startPts: 9000,
    durationPts: 900000,
    width: 1920,
    height: 1080,
  }]);

  const sceneStore = new PostgresSceneSetRevisionStore(client);
  const revision: SceneSetRevision = {
    schemaVersion: '1.0',
    sceneSetId: 'runtime-scene-set',
    revisionId: 'runtime-scene-set:r1',
    source: { assetId, streamId, streamIndex: 0, timeBase: { numerator: 2, denominator: 180000 } },
    detectorVersion: 'runtime-detector/v1',
    createdAt: '2026-08-25T13:05:00.000Z',
    scenes: [
      { sceneId: 'runtime-scene-1', sourceStartPts: 9000, sourceEndPts: 180000 },
      { sceneId: 'runtime-scene-2', sourceStartPts: 180000, sourceEndPts: 450000 },
    ],
  };

  const first = await sceneStore.registerRevision(revision);
  assert.equal(first.created, true);
  assert.deepEqual(first.revision.source.timeBase, { numerator: 1, denominator: 90000 });

  const second = await sceneStore.registerRevision(revision);
  assert.equal(second.created, false);
  assert.deepEqual(second.revision, first.revision);
  assert.deepEqual(await sceneStore.getRevision(revision.revisionId), first.revision);

  await assert.rejects(
    sceneStore.registerRevision({ ...revision, detectorVersion: 'runtime-detector/v2' }),
    /conflicts with existing immutable revision/,
  );
  assert.deepEqual(await sceneStore.getRevision(revision.revisionId), first.revision);

  const counts = await client.query<{ revisions: string; scenes: string }>(
    `SELECT
       (SELECT count(*)::text FROM scene_set_revisions WHERE revision_id = $1) AS revisions,
       (SELECT count(*)::text FROM scene_set_intervals WHERE revision_id = $1) AS scenes`,
    [revision.revisionId],
  );
  assert.equal(counts.rows[0]?.revisions, '1');
  assert.equal(counts.rows[0]?.scenes, '2');

  const columns = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name IN ('scene_set_revisions','scene_set_intervals')`,
  );
  assert(!columns.rows.some((row) => /second|millisecond/i.test(row.column_name)));

  process.stdout.write('PostgreSQL scene-library runtime proof passed: migration 0003 is applied, immutable idempotent revision persistence, exact native PTS/rational source mapping readback, and conflicting revisionId rejection.\n');
} finally {
  await client.end().catch(() => undefined);
}
