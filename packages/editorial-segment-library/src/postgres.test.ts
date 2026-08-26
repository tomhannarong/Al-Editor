import { describe, expect, it } from 'vitest';

import type { EditorialSegmentRevision } from '../../contracts/src/editorial-segment.contract.js';
import type { PostgresQueryClient, PostgresQueryResult } from '../../media-catalog/src/postgres.js';
import { EditorialSegmentPersistenceInvariantError } from './index.js';
import { PostgresEditorialSegmentRevisionStore } from './postgres.js';

const revision: EditorialSegmentRevision = {
  schemaVersion: '1.0',
  segmentSetId: 'segments-a',
  revisionId: 'segments-a:r1',
  transcriptId: 'transcript-a',
  transcriptRevisionId: 'transcript-a:r2',
  createdAt: '2026-08-26T03:20:00.000Z',
  segments: [
    { segmentId: 's1', ordinal: 0, startWordId: 'w1', endWordId: 'w2' },
    { segmentId: 's2', ordinal: 1, startWordId: 'w3', endWordId: 'w4' },
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
    segment_set_id: candidate.segmentSetId,
    transcript_id: candidate.transcriptId,
    transcript_revision_id: candidate.transcriptRevisionId,
    created_at: candidate.createdAt,
  };
}

function segmentRows(candidate = revision) {
  return candidate.segments.map((segment) => ({
    ordinal: segment.ordinal,
    segment_id: segment.segmentId,
    start_word_id: segment.startWordId,
    end_word_id: segment.endWordId,
  }));
}

describe('PostgresEditorialSegmentRevisionStore', () => {
  it('validates before opening a transaction', async () => {
    const client = new ScriptedClient(() => ({ rows: [], rowCount: 0 }));
    const store = new PostgresEditorialSegmentRevisionStore(client);
    const invalid = { ...revision, segments: [{ ...revision.segments[0]!, ordinal: 4 }] };
    await expect(store.registerRevision(invalid)).rejects.toBeInstanceOf(EditorialSegmentPersistenceInvariantError);
    expect(client.calls).toEqual([]);
  });

  it('inserts immutable revision and stable word references transactionally', async () => {
    const client = new ScriptedClient((text) => {
      if (text.includes('RETURNING revision_id')) return { rows: [{ revision_id: revision.revisionId }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const store = new PostgresEditorialSegmentRevisionStore(client);
    await expect(store.registerRevision(revision)).resolves.toEqual({ revision, created: true });
    expect(client.calls[0]?.text).toBe('BEGIN');
    const segmentInserts = client.calls.filter((call) => call.text.includes('INSERT INTO editorial_segments'));
    expect(segmentInserts).toHaveLength(2);
    expect(segmentInserts[0]?.values).toEqual([
      revision.revisionId,
      revision.transcriptRevisionId,
      0,
      's1',
      'w1',
      'w2',
    ]);
    expect(client.calls.at(-1)?.text).toBe('COMMIT');
  });

  it('returns idempotent existing evidence and rolls back immutable conflicts', async () => {
    let segments = segmentRows();
    const client = new ScriptedClient((text) => {
      if (text.includes('RETURNING revision_id')) return { rows: [], rowCount: 0 };
      if (text.includes('FROM editorial_segment_revisions')) return { rows: [revisionRow()], rowCount: 1 };
      if (text.includes('FROM editorial_segments')) return { rows: segments, rowCount: segments.length };
      return { rows: [], rowCount: 0 };
    });
    const store = new PostgresEditorialSegmentRevisionStore(client);
    await expect(store.registerRevision(revision)).resolves.toEqual({ revision, created: false });
    expect(client.calls.at(-1)?.text).toBe('COMMIT');

    segments = [{ ...segments[0]!, end_word_id: 'w3' }, segments[1]!];
    await expect(store.registerRevision(revision)).rejects.toThrow('conflicts with existing immutable revision');
    expect(client.calls.at(-1)?.text).toBe('ROLLBACK');
  });

  it('reads ordered stable word references without inventing timing columns', async () => {
    const client = new ScriptedClient((text) => {
      if (text.includes('FROM editorial_segment_revisions')) return { rows: [revisionRow()], rowCount: 1 };
      if (text.includes('FROM editorial_segments')) return { rows: segmentRows(), rowCount: revision.segments.length };
      return { rows: [], rowCount: 0 };
    });
    const store = new PostgresEditorialSegmentRevisionStore(client);
    await expect(store.getRevision(revision.revisionId)).resolves.toEqual(revision);
  });
});
