import assert from 'node:assert/strict';
import pg from 'pg';

import { PostgresMediaCatalog } from '../packages/media-catalog/src/postgres.ts';
import { PostgresTranscriptRevisionStore } from '../packages/transcript-library/src/postgres.ts';
import type { TranscriptRevision } from '../packages/contracts/src/transcript.contract.ts';

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
  const schema = await client.query<{ revisions: string | null; words: string | null }>(
    `SELECT to_regclass('public.transcript_revisions')::text AS revisions,
            to_regclass('public.transcript_words')::text AS words`,
  );
  assert.equal(schema.rows[0]?.revisions, 'transcript_revisions');
  assert.equal(schema.rows[0]?.words, 'transcript_words');

  const digest = 'b'.repeat(64);
  const assetId = `sha256:${digest}`;
  const streamId = `${assetId}:stream:1`;
  const catalog = new PostgresMediaCatalog(client);
  await catalog.registerAsset({
    schemaVersion: '1.0', assetId,
    contentDigest: { algorithm: 'sha256', hex: digest },
    byteSize: 4096,
    firstIngestedAt: '2026-08-26T00:30:00.000Z',
  });
  await catalog.replaceStreamMetadata(assetId, [{
    streamId, assetId, streamIndex: 1, kind: 'audio', codecName: 'aac',
    timeBase: { numerator: 1, denominator: 48000 }, startPts: 0, durationPts: 96000,
    sampleRate: 48000, channels: 2,
  }]);

  const asr: TranscriptRevision = {
    schemaVersion: '1.0', transcriptId: 'runtime-transcript', revisionId: 'runtime-transcript:r1',
    revisionKind: 'asr', source: { assetId, streamId, streamIndex: 1, timeBase: { numerator: 2, denominator: 96000 } },
    asrModelVersion: 'whisper-local/v1', language: 'th', createdAt: '2026-08-26T00:31:00.000Z',
    words: [
      { wordId: 'w1', ordinal: 0, text: 'สวัสดี', sourceStartPts: 0, sourceEndPts: 12000, confidence: 0.9 },
      { wordId: 'w2', ordinal: 1, text: 'ครับ', sourceStartPts: 12000, sourceEndPts: 24000 },
    ],
  };
  const store = new PostgresTranscriptRevisionStore(client);
  const first = await store.registerRevision(asr);
  assert.equal(first.created, true);
  assert.deepEqual(first.revision.source.timeBase, { numerator: 1, denominator: 48000 });
  assert.equal((await store.registerRevision(asr)).created, false);

  const correction: TranscriptRevision = {
    ...asr,
    revisionId: 'runtime-transcript:r2',
    revisionKind: 'correction',
    parentRevisionId: asr.revisionId,
    createdAt: '2026-08-26T00:32:00.000Z',
    words: asr.words.map((word, index) => index === 0 ? { ...word, text: 'หวัดดี' } : { ...word }),
  };
  const corrected = await store.registerRevision(correction);
  assert.equal(corrected.created, true);
  assert.equal(corrected.revision.parentRevisionId, asr.revisionId);
  assert.deepEqual(await store.getRevision(correction.revisionId), corrected.revision);
  assert.equal((await store.registerRevision(correction)).created, false);

  await assert.rejects(
    store.registerRevision({ ...correction, words: correction.words.map((word, index) => index === 1 ? { ...word, text: 'ค่ะ' } : word) }),
    /conflicts with existing immutable revision/,
  );
  assert.deepEqual(await store.getRevision(correction.revisionId), corrected.revision);

  const counts = await client.query<{ revisions: string; words: string }>(
    `SELECT
       (SELECT count(*)::text FROM transcript_revisions WHERE transcript_id = $1) AS revisions,
       (SELECT count(*)::text FROM transcript_words w JOIN transcript_revisions r ON r.revision_id=w.revision_id WHERE r.transcript_id=$1) AS words`,
    [asr.transcriptId],
  );
  assert.deepEqual(counts.rows[0], { revisions: '2', words: '4' });

  const durable = await client.query<{ revision_id: string; parent_revision_id: string | null; source_time_base_numerator: string; source_time_base_denominator: string }>(
    `SELECT revision_id, parent_revision_id,
            source_time_base_numerator::text, source_time_base_denominator::text
       FROM transcript_revisions WHERE transcript_id=$1 ORDER BY revision_id`,
    [asr.transcriptId],
  );
  assert.deepEqual(durable.rows, [
    { revision_id: asr.revisionId, parent_revision_id: null, source_time_base_numerator: '1', source_time_base_denominator: '48000' },
    { revision_id: correction.revisionId, parent_revision_id: asr.revisionId, source_time_base_numerator: '1', source_time_base_denominator: '48000' },
  ]);

  const columns = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name IN ('transcript_revisions','transcript_words')`,
  );
  assert(!columns.rows.some((row) => /second|millisecond/i.test(row.column_name)));

  process.stdout.write('PostgreSQL transcript runtime proof passed: exact audio-stream/time-base lineage, immutable ASR/correction parent evidence, ordered native-PTS words, idempotent re-registration and fail-closed conflict semantics are durable with no seconds/milliseconds timing authority.\n');
} finally {
  await client.end().catch(() => undefined);
}
