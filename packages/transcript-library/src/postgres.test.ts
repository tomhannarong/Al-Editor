import { describe, expect, it } from 'vitest';

import type { TranscriptRevision } from '../../contracts/src/transcript.contract.js';
import type { PostgresQueryClient, PostgresQueryResult } from '../../media-catalog/src/postgres.js';
import { TranscriptPersistenceInvariantError } from './index.js';
import { PostgresTranscriptRevisionStore } from './postgres.js';

const digest = 'a'.repeat(64);
const revision: TranscriptRevision = {
  schemaVersion: '1.0',
  transcriptId: 'transcript-a',
  revisionId: 'transcript-a:r1',
  revisionKind: 'asr',
  source: {
    assetId: `sha256:${digest}`,
    streamId: `sha256:${digest}:stream:1`,
    streamIndex: 1,
    timeBase: { numerator: 1, denominator: 48000 },
  },
  asrModelVersion: 'whisper-local/v1',
  language: 'th',
  createdAt: '2026-08-26T00:20:00.000Z',
  words: [
    { wordId: 'w1', ordinal: 0, text: 'สวัสดี', sourceStartPts: 0, sourceEndPts: 12000, confidence: 0.95 },
    { wordId: 'w2', ordinal: 1, text: 'ครับ', sourceStartPts: 12000, sourceEndPts: 24000 },
  ],
};

class ScriptedClient implements PostgresQueryClient {
  readonly calls: Array<{ text: string; values?: readonly unknown[] }> = [];
  constructor(private readonly handler: (text: string, values?: readonly unknown[]) => PostgresQueryResult) {}
  async query<Row = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<PostgresQueryResult<Row>> {
    this.calls.push(values === undefined ? { text } : { text, values });
    const result = this.handler(text, values);
    return { rows: result.rows as Row[], rowCount: result.rowCount };
  }
}

function revisionRow(candidate = revision) {
  return {
    revision_id: candidate.revisionId,
    schema_version: candidate.schemaVersion,
    transcript_id: candidate.transcriptId,
    revision_kind: candidate.revisionKind,
    parent_revision_id: candidate.parentRevisionId ?? null,
    source_asset_id: candidate.source.assetId,
    source_stream_id: candidate.source.streamId,
    source_stream_index: candidate.source.streamIndex,
    source_time_base_numerator: 1,
    source_time_base_denominator: 48000,
    asr_model_version: candidate.asrModelVersion,
    language: candidate.language,
    created_at: candidate.createdAt,
  };
}
function wordRows(candidate = revision) {
  return candidate.words.map((word) => ({
    ordinal: word.ordinal,
    word_id: word.wordId,
    text: word.text,
    source_start_pts: word.sourceStartPts,
    source_end_pts: word.sourceEndPts,
    confidence: word.confidence ?? null,
  }));
}

describe('PostgresTranscriptRevisionStore', () => {
  it('validates before opening a transaction', async () => {
    const client = new ScriptedClient(() => ({ rows: [], rowCount: 0 }));
    const store = new PostgresTranscriptRevisionStore(client);
    const invalid = { ...revision, words: [{ ...revision.words[0]!, sourceStartPts: 1.5 }] };
    await expect(store.registerRevision(invalid)).rejects.toBeInstanceOf(TranscriptPersistenceInvariantError);
    expect(client.calls).toEqual([]);
  });

  it('inserts normalized immutable revision and ordered native-PTS words transactionally', async () => {
    const client = new ScriptedClient((text) => {
      if (text.includes('RETURNING revision_id')) return { rows: [{ revision_id: revision.revisionId }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const store = new PostgresTranscriptRevisionStore(client);
    const equivalent = { ...revision, source: { ...revision.source, timeBase: { numerator: 2, denominator: 96000 } } };
    await expect(store.registerRevision(equivalent)).resolves.toEqual({ revision, created: true });
    expect(client.calls[0]?.text).toBe('BEGIN');
    expect(client.calls[1]?.values?.[8]).toBe(1);
    expect(client.calls[1]?.values?.[9]).toBe(48000);
    const wordInserts = client.calls.filter((call) => call.text.includes('INSERT INTO transcript_words'));
    expect(wordInserts).toHaveLength(2);
    expect(wordInserts[0]?.values).toEqual([revision.revisionId, 0, 'w1', 'สวัสดี', 0, 12000, 0.95]);
    expect(client.calls.at(-1)?.text).toBe('COMMIT');
  });

  it('returns idempotent existing evidence and rolls back immutable conflicts', async () => {
    let words = wordRows();
    const client = new ScriptedClient((text) => {
      if (text.includes('RETURNING revision_id')) return { rows: [], rowCount: 0 };
      if (text.includes('FROM transcript_revisions')) return { rows: [revisionRow()], rowCount: 1 };
      if (text.includes('FROM transcript_words')) return { rows: words, rowCount: words.length };
      return { rows: [], rowCount: 0 };
    });
    const store = new PostgresTranscriptRevisionStore(client);
    await expect(store.registerRevision(revision)).resolves.toEqual({ revision, created: false });
    expect(client.calls.at(-1)?.text).toBe('COMMIT');
    words = [{ ...words[0]!, text: 'เปลี่ยน' }, words[1]!];
    await expect(store.registerRevision(revision)).rejects.toThrow('conflicts with existing immutable revision');
    expect(client.calls.at(-1)?.text).toBe('ROLLBACK');
  });

  it('reads correction lineage and optional confidence without inventing derived timing', async () => {
    const correction: TranscriptRevision = {
      ...revision,
      revisionId: 'transcript-a:r2',
      revisionKind: 'correction',
      parentRevisionId: revision.revisionId,
      words: revision.words.map((word, index) => index === 0 ? { ...word, text: 'หวัดดี' } : { ...word }),
    };
    const client = new ScriptedClient((text) => {
      if (text.includes('FROM transcript_revisions')) return { rows: [revisionRow(correction)], rowCount: 1 };
      if (text.includes('FROM transcript_words')) return { rows: wordRows(correction), rowCount: correction.words.length };
      return { rows: [], rowCount: 0 };
    });
    const store = new PostgresTranscriptRevisionStore(client);
    await expect(store.getRevision(correction.revisionId)).resolves.toEqual(correction);
  });
});
