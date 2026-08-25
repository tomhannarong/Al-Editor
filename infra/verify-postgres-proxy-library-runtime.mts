import assert from 'node:assert/strict';
import pg from 'pg';

import { PostgresMediaCatalog } from '../packages/media-catalog/src/postgres.ts';
import { PostgresSceneSetRevisionStore } from '../packages/scene-library/src/postgres.ts';
import { PostgresProxyDerivativeRevisionStore } from '../packages/proxy-library/src/postgres.ts';
import type { SceneSetRevision } from '../packages/contracts/src/scene-set.contract.ts';
import type { ProxyDerivativeRevision } from '../packages/contracts/src/proxy-derivative.contract.ts';

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

  const schemaCheck = await client.query<{ proxy_derivative_revisions: string | null }>(
    `SELECT to_regclass('public.proxy_derivative_revisions')::text AS proxy_derivative_revisions`,
  );
  assert.equal(
    schemaCheck.rows[0]?.proxy_derivative_revisions,
    'proxy_derivative_revisions',
    'migration 0004 proxy_derivative_revisions is not applied',
  );

  const digest = 'c'.repeat(64);
  const assetId = `sha256:${digest}`;
  const streamId = `${assetId}:stream:0`;
  const catalog = new PostgresMediaCatalog(client);
  await catalog.registerAsset({
    schemaVersion: '1.0',
    assetId,
    contentDigest: { algorithm: 'sha256', hex: digest },
    byteSize: 8192,
    firstIngestedAt: '2026-08-25T15:40:00.000Z',
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
    sceneSetId: 'runtime-proxy-scene-set',
    revisionId: 'runtime-proxy-scene-set:r1',
    source: {
      assetId,
      streamId,
      streamIndex: 0,
      timeBase: { numerator: 2, denominator: 180000 },
    },
    detectorVersion: 'runtime-detector/v1',
    createdAt: '2026-08-25T15:41:00.000Z',
    scenes: [
      { sceneId: 'runtime-proxy-scene-1', sourceStartPts: 9000, sourceEndPts: 180000 },
    ],
  };
  const sceneStore = new PostgresSceneSetRevisionStore(client);
  const persistedScene = await sceneStore.registerRevision(sceneRevision);
  assert.deepEqual(persistedScene.revision.source.timeBase, { numerator: 1, denominator: 90000 });

  const proxyRevision: ProxyDerivativeRevision = {
    schemaVersion: '1.0',
    derivativeId: 'runtime-proxy',
    revisionId: 'runtime-proxy:r1',
    source: {
      sceneSetId: sceneRevision.sceneSetId,
      sceneSetRevisionId: sceneRevision.revisionId,
      assetId,
      streamId,
      streamIndex: 0,
      timeBase: { numerator: 2, denominator: 180000 },
    },
    derivativeProfileVersion: 'proxy-profile/v1',
    toolchain: { name: 'ffmpeg', version: 'runtime-pinned' },
    artifactUri: 'file:///runtime/derived/runtime-proxy-r1.mp4',
    createdAt: '2026-08-25T15:42:00.000Z',
  };

  const proxyStore = new PostgresProxyDerivativeRevisionStore(client);
  const first = await proxyStore.registerRevision(proxyRevision);
  assert.equal(first.created, true);
  assert.deepEqual(first.revision.source.timeBase, { numerator: 1, denominator: 90000 });

  const second = await proxyStore.registerRevision(proxyRevision);
  assert.equal(second.created, false);
  assert.deepEqual(second.revision, first.revision);
  assert.deepEqual(await proxyStore.getRevision(proxyRevision.revisionId), first.revision);

  await assert.rejects(
    proxyStore.registerRevision({ ...proxyRevision, artifactUri: 'file:///runtime/derived/conflict.mp4' }),
    /conflicts with existing immutable revision/,
  );
  assert.deepEqual(await proxyStore.getRevision(proxyRevision.revisionId), first.revision);

  const counts = await client.query<{ revisions: string }>(
    `SELECT count(*)::text AS revisions
       FROM proxy_derivative_revisions
      WHERE revision_id = $1`,
    [proxyRevision.revisionId],
  );
  assert.equal(counts.rows[0]?.revisions, '1');

  const durableRow = await client.query<{
    scene_set_id: string;
    scene_set_revision_id: string;
    source_asset_id: string;
    source_stream_id: string;
    source_stream_index: number;
    source_time_base_numerator: string;
    source_time_base_denominator: string;
  }>(
    `SELECT scene_set_id, scene_set_revision_id,
            source_asset_id, source_stream_id, source_stream_index,
            source_time_base_numerator::text, source_time_base_denominator::text
       FROM proxy_derivative_revisions
      WHERE revision_id = $1`,
    [proxyRevision.revisionId],
  );
  assert.deepEqual(durableRow.rows[0], {
    scene_set_id: sceneRevision.sceneSetId,
    scene_set_revision_id: sceneRevision.revisionId,
    source_asset_id: assetId,
    source_stream_id: streamId,
    source_stream_index: 0,
    source_time_base_numerator: '1',
    source_time_base_denominator: '90000',
  });

  const columns = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'proxy_derivative_revisions'`,
  );
  assert(!columns.rows.some((row) => /second|millisecond/i.test(row.column_name)));

  process.stdout.write(
    'PostgreSQL proxy-library runtime proof passed: migration 0004 is applied, exact scene/source lineage is durable, semantic re-registration is idempotent, conflicting immutable evidence is rejected, and native rational timing remains authoritative.\n',
  );
} finally {
  await client.end().catch(() => undefined);
}
