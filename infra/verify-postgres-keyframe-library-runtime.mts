import assert from 'node:assert/strict';
import pg from 'pg';

import { PostgresMediaCatalog } from '../packages/media-catalog/src/postgres.ts';
import { PostgresSceneSetRevisionStore } from '../packages/scene-library/src/postgres.ts';
import { PostgresKeyframeDerivativeRevisionStore } from '../packages/keyframe-library/src/postgres.ts';
import type { SceneSetRevision } from '../packages/contracts/src/scene-set.contract.ts';
import type { KeyframeDerivativeRevision } from '../packages/contracts/src/keyframe-derivative.contract.ts';

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

  const schemaCheck = await client.query<{
    keyframe_derivative_revisions: string | null;
    keyframe_derivative_frames: string | null;
  }>(
    `SELECT to_regclass('public.keyframe_derivative_revisions')::text AS keyframe_derivative_revisions,
            to_regclass('public.keyframe_derivative_frames')::text AS keyframe_derivative_frames`,
  );
  assert.equal(schemaCheck.rows[0]?.keyframe_derivative_revisions, 'keyframe_derivative_revisions');
  assert.equal(schemaCheck.rows[0]?.keyframe_derivative_frames, 'keyframe_derivative_frames');

  const digest = 'd'.repeat(64);
  const assetId = `sha256:${digest}`;
  const streamId = `${assetId}:stream:0`;
  const catalog = new PostgresMediaCatalog(client);
  await catalog.registerAsset({
    schemaVersion: '1.0',
    assetId,
    contentDigest: { algorithm: 'sha256', hex: digest },
    byteSize: 12288,
    firstIngestedAt: '2026-08-25T19:30:00.000Z',
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

  const sceneRevision: SceneSetRevision = {
    schemaVersion: '1.0',
    sceneSetId: 'runtime-keyframe-scene-set',
    revisionId: 'runtime-keyframe-scene-set:r1',
    source: {
      assetId,
      streamId,
      streamIndex: 0,
      timeBase: { numerator: 2, denominator: 180000 },
    },
    detectorVersion: 'runtime-detector/v1',
    createdAt: '2026-08-25T19:31:00.000Z',
    scenes: [
      { sceneId: 'runtime-keyframe-scene-1', sourceStartPts: 9000, sourceEndPts: 180000 },
    ],
  };
  const sceneStore = new PostgresSceneSetRevisionStore(client);
  await sceneStore.registerRevision(sceneRevision);

  const keyframeRevision: KeyframeDerivativeRevision = {
    schemaVersion: '1.0',
    derivativeId: 'runtime-keyframes',
    revisionId: 'runtime-keyframes:r1',
    source: {
      sceneSetId: sceneRevision.sceneSetId,
      sceneSetRevisionId: sceneRevision.revisionId,
      sceneId: sceneRevision.scenes[0]!.sceneId,
      assetId,
      streamId,
      streamIndex: 0,
      timeBase: { numerator: 2, denominator: 180000 },
    },
    derivativeProfileVersion: 'keyframe-profile/v1',
    toolchain: { name: 'ffmpeg', version: 'runtime-pinned' },
    createdAt: '2026-08-25T19:32:00.000Z',
    frames: [
      { frameId: 'runtime-kf-1', sourcePts: 9000, artifactUri: 'file:///runtime/derived/keyframes/runtime-kf-1.jpg' },
      { frameId: 'runtime-kf-2', sourcePts: 90000, artifactUri: 'file:///runtime/derived/keyframes/runtime-kf-2.jpg' },
    ],
  };

  const keyframeStore = new PostgresKeyframeDerivativeRevisionStore(client);
  const first = await keyframeStore.registerRevision(keyframeRevision);
  assert.equal(first.created, true);
  assert.deepEqual(first.revision.source.timeBase, { numerator: 1, denominator: 90000 });

  const second = await keyframeStore.registerRevision(keyframeRevision);
  assert.equal(second.created, false);
  assert.deepEqual(second.revision, first.revision);
  assert.deepEqual(await keyframeStore.getRevision(keyframeRevision.revisionId), first.revision);

  await assert.rejects(
    keyframeStore.registerRevision({
      ...keyframeRevision,
      frames: keyframeRevision.frames.map((frame, index) => index === 0
        ? { ...frame, artifactUri: 'file:///runtime/derived/keyframes/conflict.jpg' }
        : frame),
    }),
    /conflicts with existing immutable revision/,
  );
  assert.deepEqual(await keyframeStore.getRevision(keyframeRevision.revisionId), first.revision);

  const counts = await client.query<{ revisions: string; frames: string }>(
    `SELECT
       (SELECT count(*)::text FROM keyframe_derivative_revisions WHERE revision_id = $1) AS revisions,
       (SELECT count(*)::text FROM keyframe_derivative_frames WHERE revision_id = $1) AS frames`,
    [keyframeRevision.revisionId],
  );
  assert.deepEqual(counts.rows[0], { revisions: '1', frames: '2' });

  const durableRows = await client.query<{
    frame_id: string;
    source_pts: string;
    scene_set_id: string;
    scene_set_revision_id: string;
    scene_id: string;
    source_time_base_numerator: string;
    source_time_base_denominator: string;
  }>(
    `SELECT f.frame_id, f.source_pts::text,
            r.scene_set_id, r.scene_set_revision_id, r.scene_id,
            r.source_time_base_numerator::text, r.source_time_base_denominator::text
       FROM keyframe_derivative_revisions r
       JOIN keyframe_derivative_frames f ON f.revision_id = r.revision_id
      WHERE r.revision_id = $1
      ORDER BY f.ordinal`,
    [keyframeRevision.revisionId],
  );
  assert.deepEqual(durableRows.rows, [
    {
      frame_id: 'runtime-kf-1',
      source_pts: '9000',
      scene_set_id: sceneRevision.sceneSetId,
      scene_set_revision_id: sceneRevision.revisionId,
      scene_id: sceneRevision.scenes[0]!.sceneId,
      source_time_base_numerator: '1',
      source_time_base_denominator: '90000',
    },
    {
      frame_id: 'runtime-kf-2',
      source_pts: '90000',
      scene_set_id: sceneRevision.sceneSetId,
      scene_set_revision_id: sceneRevision.revisionId,
      scene_id: sceneRevision.scenes[0]!.sceneId,
      source_time_base_numerator: '1',
      source_time_base_denominator: '90000',
    },
  ]);

  const columns = await client.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('keyframe_derivative_revisions', 'keyframe_derivative_frames')`,
  );
  assert(!columns.rows.some((row) => /second|millisecond/i.test(row.column_name)));

  process.stdout.write(
    'PostgreSQL keyframe-library runtime proof passed: migration 0005 is applied, exact scene/source lineage and ordered native-PTS frame evidence are durable, semantic re-registration is idempotent, conflicting immutable evidence is rejected, and no seconds/milliseconds timing authority exists.\n',
  );
} finally {
  await client.end().catch(() => undefined);
}
