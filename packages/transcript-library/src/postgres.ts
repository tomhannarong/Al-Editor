import { normalizeCanonicalRational } from '../../contracts/src/canonical-timeline.contract.js';
import {
  validateTranscriptRevision,
  type TranscriptRevision,
} from '../../contracts/src/transcript.contract.js';
import type { PostgresQueryClient } from '../../media-catalog/src/postgres.js';
import {
  TranscriptPersistenceInvariantError,
  sameImmutableTranscriptRevision,
  type RegisterTranscriptRevisionResult,
} from './index.js';

type RevisionRow = {
  revision_id: string;
  schema_version: TranscriptRevision['schemaVersion'];
  transcript_id: string;
  revision_kind: TranscriptRevision['revisionKind'];
  parent_revision_id: string | null;
  source_asset_id: string;
  source_stream_id: string;
  source_stream_index: string | number;
  source_time_base_numerator: string | number;
  source_time_base_denominator: string | number;
  asr_model_version: string;
  language: string;
  created_at: string;
};

type WordRow = {
  ordinal: string | number;
  word_id: string;
  text: string;
  source_start_pts: string | number;
  source_end_pts: string | number;
  confidence: string | number | null;
};

/**
 * Durable PostgreSQL boundary for immutable transcript revisions. The database
 * constrains every revision to an exact persisted audio stream/time-base tuple
 * and correction parents to the same transcript + source tuple. Native word PTS
 * remain authoritative; no milliseconds/decimal seconds are persisted.
 */
export class PostgresTranscriptRevisionStore {
  constructor(private readonly client: PostgresQueryClient) {}

  async registerRevision(candidate: TranscriptRevision): Promise<RegisterTranscriptRevisionResult> {
    assertValidRevision(candidate);
    const normalized = cloneNormalizedRevision(candidate);

    await this.client.query('BEGIN');
    try {
      const inserted = await this.client.query<{ revision_id: string }>(
        `INSERT INTO transcript_revisions (
           revision_id, schema_version, transcript_id, revision_kind, parent_revision_id,
           source_asset_id, source_stream_id, source_stream_index,
           source_time_base_numerator, source_time_base_denominator, source_stream_kind,
           asr_model_version, language, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'audio',$11,$12,$13)
         ON CONFLICT (revision_id) DO NOTHING
         RETURNING revision_id`,
        [
          normalized.revisionId,
          normalized.schemaVersion,
          normalized.transcriptId,
          normalized.revisionKind,
          normalized.parentRevisionId ?? null,
          normalized.source.assetId,
          normalized.source.streamId,
          normalized.source.streamIndex,
          normalized.source.timeBase.numerator,
          normalized.source.timeBase.denominator,
          normalized.asrModelVersion,
          normalized.language,
          normalized.createdAt,
        ],
      );

      if (inserted.rows[0]) {
        for (const word of normalized.words) {
          await this.client.query(
            `INSERT INTO transcript_words (
               revision_id, ordinal, word_id, text, source_start_pts, source_end_pts, confidence
             ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [
              normalized.revisionId,
              word.ordinal,
              word.wordId,
              word.text,
              word.sourceStartPts,
              word.sourceEndPts,
              word.confidence ?? null,
            ],
          );
        }
        await this.client.query('COMMIT');
        return { revision: cloneNormalizedRevision(normalized), created: true };
      }

      const existing = await this.getRevisionInternal(normalized.revisionId);
      if (!existing) {
        throw new TranscriptPersistenceInvariantError('transcript revision conflict disappeared before readback');
      }
      if (!sameImmutableTranscriptRevision(existing, normalized)) {
        throw new TranscriptPersistenceInvariantError(
          `transcript revisionId ${normalized.revisionId} conflicts with existing immutable revision`,
        );
      }

      await this.client.query('COMMIT');
      return { revision: cloneNormalizedRevision(existing), created: false };
    } catch (error) {
      await this.client.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }

  async getRevision(revisionId: string): Promise<TranscriptRevision | undefined> {
    return this.getRevisionInternal(revisionId);
  }

  private async getRevisionInternal(revisionId: string): Promise<TranscriptRevision | undefined> {
    const revisionResult = await this.client.query<RevisionRow>(
      `SELECT revision_id, schema_version, transcript_id, revision_kind, parent_revision_id,
              source_asset_id, source_stream_id, source_stream_index,
              source_time_base_numerator, source_time_base_denominator,
              asr_model_version, language, created_at
         FROM transcript_revisions
        WHERE revision_id = $1`,
      [revisionId],
    );
    const row = revisionResult.rows[0];
    if (!row) return undefined;

    const wordResult = await this.client.query<WordRow>(
      `SELECT ordinal, word_id, text, source_start_pts, source_end_pts, confidence
         FROM transcript_words
        WHERE revision_id = $1
        ORDER BY ordinal ASC`,
      [revisionId],
    );

    const base = {
      schemaVersion: row.schema_version,
      transcriptId: row.transcript_id,
      revisionId: row.revision_id,
      source: {
        assetId: row.source_asset_id,
        streamId: row.source_stream_id,
        streamIndex: parseSafeInteger(row.source_stream_index, 'source_stream_index'),
        timeBase: normalizeCanonicalRational({
          numerator: parseSafeInteger(row.source_time_base_numerator, 'source_time_base_numerator'),
          denominator: parseSafeInteger(row.source_time_base_denominator, 'source_time_base_denominator'),
        }),
      },
      revisionKind: row.revision_kind,
      asrModelVersion: row.asr_model_version,
      language: row.language,
      createdAt: row.created_at,
      words: wordResult.rows.map((word) => ({
        wordId: word.word_id,
        ordinal: parseSafeInteger(word.ordinal, 'ordinal'),
        text: word.text,
        sourceStartPts: parseSafeInteger(word.source_start_pts, 'source_start_pts'),
        sourceEndPts: parseSafeInteger(word.source_end_pts, 'source_end_pts'),
        ...(word.confidence === null ? {} : { confidence: parseConfidence(word.confidence) }),
      })),
    };
    const revision: TranscriptRevision = row.parent_revision_id === null
      ? base
      : { ...base, parentRevisionId: row.parent_revision_id };
    assertValidRevision(revision);
    return cloneNormalizedRevision(revision);
  }
}

function assertValidRevision(candidate: TranscriptRevision): void {
  const validation = validateTranscriptRevision(candidate);
  if (!validation.valid) throw new TranscriptPersistenceInvariantError(validation.errors.join('; '));
}

function cloneNormalizedRevision(revision: TranscriptRevision): TranscriptRevision {
  const timeBase = normalizeCanonicalRational(revision.source.timeBase);
  return {
    ...revision,
    source: { ...revision.source, timeBase: { ...timeBase } },
    words: revision.words.map((word) => ({ ...word })),
  };
}

function parseSafeInteger(value: string | number, label: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new TranscriptPersistenceInvariantError(`${label} exceeds JavaScript safe-integer range`);
  }
  return parsed;
}

function parseConfidence(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new TranscriptPersistenceInvariantError('confidence must be between 0 and 1');
  }
  return parsed;
}
