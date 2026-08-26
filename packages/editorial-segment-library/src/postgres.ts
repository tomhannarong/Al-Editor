import {
  validateEditorialSegmentRevision,
  type EditorialSegmentRevision,
} from '../../contracts/src/editorial-segment.contract.js';
import type { PostgresQueryClient } from '../../media-catalog/src/postgres.js';
import {
  EditorialSegmentPersistenceInvariantError,
  sameImmutableEditorialSegmentRevision,
  type RegisterEditorialSegmentRevisionResult,
} from './index.js';

type RevisionRow = {
  revision_id: string;
  schema_version: EditorialSegmentRevision['schemaVersion'];
  segment_set_id: string;
  transcript_id: string;
  transcript_revision_id: string;
  created_at: string;
};

type SegmentRow = {
  ordinal: string | number;
  segment_id: string;
  start_word_id: string;
  end_word_id: string;
};

/**
 * Durable PostgreSQL boundary for immutable editorial-segment revisions.
 * Segment rows persist only stable transcript word references; source timing
 * remains derived from the exact bound immutable transcript revision.
 */
export class PostgresEditorialSegmentRevisionStore {
  constructor(private readonly client: PostgresQueryClient) {}

  async registerRevision(candidate: EditorialSegmentRevision): Promise<RegisterEditorialSegmentRevisionResult> {
    assertValidRevision(candidate);
    const normalized = cloneRevision(candidate);

    await this.client.query('BEGIN');
    try {
      const inserted = await this.client.query<{ revision_id: string }>(
        `INSERT INTO editorial_segment_revisions (
           revision_id, schema_version, segment_set_id,
           transcript_id, transcript_revision_id, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (revision_id) DO NOTHING
         RETURNING revision_id`,
        [
          normalized.revisionId,
          normalized.schemaVersion,
          normalized.segmentSetId,
          normalized.transcriptId,
          normalized.transcriptRevisionId,
          normalized.createdAt,
        ],
      );

      if (inserted.rows[0]) {
        for (const segment of normalized.segments) {
          await this.client.query(
            `INSERT INTO editorial_segments (
               revision_id, transcript_revision_id, ordinal,
               segment_id, start_word_id, end_word_id
             ) VALUES ($1,$2,$3,$4,$5,$6)`,
            [
              normalized.revisionId,
              normalized.transcriptRevisionId,
              segment.ordinal,
              segment.segmentId,
              segment.startWordId,
              segment.endWordId,
            ],
          );
        }
        await this.client.query('COMMIT');
        return { revision: cloneRevision(normalized), created: true };
      }

      const existing = await this.getRevisionInternal(normalized.revisionId);
      if (!existing) {
        throw new EditorialSegmentPersistenceInvariantError(
          'editorial segment revision conflict disappeared before readback',
        );
      }
      if (!sameImmutableEditorialSegmentRevision(existing, normalized)) {
        throw new EditorialSegmentPersistenceInvariantError(
          `editorial segment revisionId ${normalized.revisionId} conflicts with existing immutable revision`,
        );
      }

      await this.client.query('COMMIT');
      return { revision: cloneRevision(existing), created: false };
    } catch (error) {
      await this.client.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }

  async getRevision(revisionId: string): Promise<EditorialSegmentRevision | undefined> {
    return this.getRevisionInternal(revisionId);
  }

  private async getRevisionInternal(revisionId: string): Promise<EditorialSegmentRevision | undefined> {
    const revisionResult = await this.client.query<RevisionRow>(
      `SELECT revision_id, schema_version, segment_set_id,
              transcript_id, transcript_revision_id, created_at
         FROM editorial_segment_revisions
        WHERE revision_id = $1`,
      [revisionId],
    );
    const row = revisionResult.rows[0];
    if (!row) return undefined;

    const segmentResult = await this.client.query<SegmentRow>(
      `SELECT ordinal, segment_id, start_word_id, end_word_id
         FROM editorial_segments
        WHERE revision_id = $1
        ORDER BY ordinal ASC`,
      [revisionId],
    );

    const revision: EditorialSegmentRevision = {
      schemaVersion: row.schema_version,
      segmentSetId: row.segment_set_id,
      revisionId: row.revision_id,
      transcriptId: row.transcript_id,
      transcriptRevisionId: row.transcript_revision_id,
      createdAt: row.created_at,
      segments: segmentResult.rows.map((segment) => ({
        segmentId: segment.segment_id,
        ordinal: parseSafeInteger(segment.ordinal, 'ordinal'),
        startWordId: segment.start_word_id,
        endWordId: segment.end_word_id,
      })),
    };
    assertValidRevision(revision);
    return cloneRevision(revision);
  }
}

function assertValidRevision(candidate: EditorialSegmentRevision): void {
  const validation = validateEditorialSegmentRevision(candidate);
  if (!validation.valid) {
    throw new EditorialSegmentPersistenceInvariantError(validation.errors.join('; '));
  }
}

function cloneRevision(revision: EditorialSegmentRevision): EditorialSegmentRevision {
  return {
    ...revision,
    segments: revision.segments.map((segment) => ({ ...segment })),
  };
}

function parseSafeInteger(value: string | number, label: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new EditorialSegmentPersistenceInvariantError(`${label} exceeds JavaScript safe-integer range`);
  }
  return parsed;
}
