import assert from 'node:assert/strict';
import pg from 'pg';

import { PostgresMediaCatalog } from '../packages/media-catalog/src/postgres.ts';
import { PostgresTranscriptRevisionStore } from '../packages/transcript-library/src/postgres.ts';
import { PostgresEditorialSegmentRevisionStore } from '../packages/editorial-segment-library/src/postgres.ts';
import type { TranscriptRevision } from '../packages/contracts/src/transcript.contract.ts';
import type { EditorialSegmentRevision } from '../packages/contracts/src/editorial-segment.contract.ts';

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
  const schema = await client.query<{ revisions: string | null; segments: string | null }>(
    `SELECT to_regclass('public.editorial_segment_revisions')::text AS revisions,
            to_regclass('public.editorial_segments')::text AS segments`,
  );
  assert.equal(schema.rows[0]?.revisions, 'editorial_segment_revisions');
  assert.equal(schema.rows[0]?.segments, 'editorial_segments');

  const digest = 'c'.repeat(64);
  const assetId = `sha256:${digest}`;
  const streamId = `${assetId}:stream:1`;
  const catalog = new PostgresMediaCatalog(client);
  await catalog.registerAsset({
    schemaVersion: '1.0',
    assetId,
    contentDigest: { algorithm: 'sha256', hex: digest },
    byteSize: 8192,
    firstIngestedAt: '2026-08-26T03:30:00.000Z',
  });
  await catalog.replaceStreamMetadata(assetId, [{
    streamId,
    assetId,
    streamIndex: 1,
    kind: 'audio',
    codecName: 'aac',
    timeBase: { numerator: 1, denominator: 48000 },
    startPts: 0,
    durationPts: 96000,
    sampleRate: 48000,
    channels: 2,
  }]);

  const transcript: TranscriptRevision = {
    schemaVersion: '1.0',
    transcriptId: 'runtime-segment-transcript',
    revisionId: 'runtime-segment-transcript:r1',
    revisionKind: 'asr',
    source: { assetId, streamId, streamIndex: 1, timeBase: { numerator: 1, denominator: 48000 } },
    asrModelVersion: 'whisper-local/v1',
    language: 'th',
    createdAt: '2026-08-26T03:31:00.000Z',
    words: [
      { wordId: 'w1', ordinal: 0, text: 'เรา', sourceStartPts: 0, sourceEndPts: 12000 },
      { wordId: 'w2', ordinal: 1, text: 'ไป', sourceStartPts: 12000, sourceEndPts: 24000 },
      { wordId: 'w3', ordinal: 2, text: 'เที่ยว', sourceStartPts: 24000, sourceEndPts: 36000 },
      { wordId: 'w4', ordinal: 3, text: 'กัน', sourceStartPts: 36000, sourceEndPts: 48000 },
    ],
  };
  const transcriptStore = new PostgresTranscriptRevisionStore(client);
  assert.equal((await transcriptStore.registerRevision(transcript)).created, true);

  const revision: EditorialSegmentRevision = {
    schemaVersion: '1.0',
    segmentSetId: 'runtime-segments',
    revisionId: 'runtime-segments:r1',
    transcriptId: transcript.transcriptId,
    transcriptRevisionId: transcript.revisionId,
    createdAt: '2026-08-26T03:32:00.000Z',
    segments: [
      { segmentId: 's1', ordinal: 0, startWordId: 'w1', endWordId: 'w2' },
      { segmentId: 's2', ordinal: 1, startWordId: 'w3', endWordId: 'w4' },
    ],
  };

  const store = new PostgresEditorialSegmentRevisionStore(client);
  const first = await store.registerRevision(revision);
  assert.equal(first.created, true);
  assert.deepEqual(first.revision, revision);
  assert.equal((await store.registerRevision(revision)).created, false);
  assert.deepEqual(await store.getRevision(revision.revisionId), revision);

  await assert.rejects(
    store.registerRevision({
      ...revision,
      segments: revision.segments.map((segment, index) => index === 0 ? { ...segment, endWordId: 'w3' } : { ...segment }),
    }),
    /conflicts with existing immutable revision/,
  );
  assert.deepEqual(await store.getRevision(revision.revisionId), revision);

  const invalidWordRevision: EditorialSegmentRevision = {
    ...revision,
    revisionId: 'runtime-segments:r2',
    createdAt: '2026-08-26T03:33:00.000Z',
    segments: [{ segmentId: 's-missing', ordinal: 0, startWordId: 'w1', endWordId: 'missing-word' }],
  };
  await assert.rejects(store.registerRevision(invalidWordRevision), /foreign key|violates/i);
  assert.equal(await store.getRevision(invalidWordRevision.revisionId), undefined);

  const counts = await client.query<{ revisions: string; segments: string }>(
    `SELECT
       (SELECT count(*)::text FROM editorial_segment_revisions WHERE segment_set_id=$1) AS revisions,
       (SELECT count(*)::text FROM editorial_segments s JOIN editorial_segment_revisions r ON r.revision_id=s.revision_id WHERE r.segment_set_id=$1) AS segments`,
    [revision.segmentSetId],
  );
  assert.deepEqual(counts.rows[0], { revisions: '1', segments: '2' });

  const durable = await client.query<{
    revision_id: string;
    transcript_id: string;
    transcript_revision_id: string;
    ordinal: number;
    segment_id: string;
    start_word_id: string;
    end_word_id: string;
  }>(
    `SELECT r.revision_id, r.transcript_id, r.transcript_revision_id,
            s.ordinal, s.segment_id, s.start_word_id, s.end_word_id
       FROM editorial_segment_revisions r
       JOIN editorial_segments s ON s.revision_id=r.revision_id
      WHERE r.revision_id=$1
      ORDER BY s.ordinal`,
    [revision.revisionId],
  );
  assert.deepEqual(durable.rows, [
    {
      revision_id: revision.revisionId,
      transcript_id: transcript.transcriptId,
      transcript_revision_id: transcript.revisionId,
      ordinal: 0,
      segment_id: 's1',
      start_word_id: 'w1',
      end_word_id: 'w2',
    },
    {
      revision_id: revision.revisionId,
      transcript_id: transcript.transcriptId,
      transcript_revision_id: transcript.revisionId,
      ordinal: 1,
      segment_id: 's2',
      start_word_id: 'w3',
      end_word_id: 'w4',
    },
  ]);

  const columns = await client.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema='public'
        AND table_name IN ('editorial_segment_revisions','editorial_segments')`,
  );
  assert(!columns.rows.some((row) => /pts|second|millisecond/i.test(row.column_name)));

  process.stdout.write('PostgreSQL editorial-segment runtime proof passed: exact transcript-revision/stable-word lineage, immutable idempotent revision evidence, fail-closed conflict/missing-word semantics and ordered durable readback hold with no duplicate timing authority.\n');
} finally {
  await client.end().catch(() => undefined);
}
