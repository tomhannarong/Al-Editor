import { normalizeCanonicalRational } from '../../contracts/src/canonical-timeline.contract.js';
import {
  validateKeyframeDerivativeRevision,
  type KeyframeDerivativeRevision,
} from '../../contracts/src/keyframe-derivative.contract.js';
import type { PostgresQueryClient } from '../../media-catalog/src/postgres.js';
import {
  KeyframeDerivativePersistenceInvariantError,
  sameImmutableKeyframeDerivativeRevision,
  type RegisterKeyframeDerivativeRevisionResult,
} from './index.js';

type RevisionRow = {
  revision_id: string;
  schema_version: KeyframeDerivativeRevision['schemaVersion'];
  derivative_id: string;
  scene_set_id: string;
  scene_set_revision_id: string;
  scene_id: string;
  source_asset_id: string;
  source_stream_id: string;
  source_stream_index: string | number;
  source_time_base_numerator: string | number;
  source_time_base_denominator: string | number;
  derivative_profile_version: string;
  toolchain_name: string;
  toolchain_version: string;
  created_at: string;
};

type FrameRow = {
  frame_id: string;
  source_pts: string | number;
  artifact_uri: string;
};

/**
 * Durable PostgreSQL boundary for immutable keyframe derivative revision evidence.
 * Scene/source lineage is constrained to the exact persisted scene-set revision;
 * frame image locations remain rebuildable derivative state while native sourcePts
 * plus rational source time base remain authoritative.
 */
export class PostgresKeyframeDerivativeRevisionStore {
  constructor(private readonly client: PostgresQueryClient) {}

  async registerRevision(candidate: KeyframeDerivativeRevision): Promise<RegisterKeyframeDerivativeRevisionResult> {
    assertValidRevision(candidate);
    const normalized = cloneNormalizedRevision(candidate);

    await this.client.query('BEGIN');
    try {
      const inserted = await this.client.query<{ revision_id: string }>(
        `INSERT INTO keyframe_derivative_revisions (
           revision_id, schema_version, derivative_id,
           scene_set_id, scene_set_revision_id, scene_id,
           source_asset_id, source_stream_id, source_stream_index,
           source_time_base_numerator, source_time_base_denominator,
           derivative_profile_version, toolchain_name, toolchain_version, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (revision_id) DO NOTHING
         RETURNING revision_id`,
        [
          normalized.revisionId,
          normalized.schemaVersion,
          normalized.derivativeId,
          normalized.source.sceneSetId,
          normalized.source.sceneSetRevisionId,
          normalized.source.sceneId,
          normalized.source.assetId,
          normalized.source.streamId,
          normalized.source.streamIndex,
          normalized.source.timeBase.numerator,
          normalized.source.timeBase.denominator,
          normalized.derivativeProfileVersion,
          normalized.toolchain.name,
          normalized.toolchain.version,
          normalized.createdAt,
        ],
      );

      if (inserted.rows[0]) {
        for (const [ordinal, frame] of normalized.frames.entries()) {
          await this.client.query(
            `INSERT INTO keyframe_derivative_frames (
               revision_id, ordinal, frame_id, source_pts, artifact_uri
             ) VALUES ($1,$2,$3,$4,$5)`,
            [normalized.revisionId, ordinal, frame.frameId, frame.sourcePts, frame.artifactUri],
          );
        }
        await this.client.query('COMMIT');
        return { revision: cloneNormalizedRevision(normalized), created: true };
      }

      const existing = await this.getRevisionInternal(normalized.revisionId);
      if (!existing) {
        throw new KeyframeDerivativePersistenceInvariantError(
          'keyframe derivative revision conflict disappeared before readback',
        );
      }
      if (!sameImmutableKeyframeDerivativeRevision(existing, normalized)) {
        throw new KeyframeDerivativePersistenceInvariantError(
          `keyframe derivative revisionId ${normalized.revisionId} conflicts with existing immutable revision`,
        );
      }

      await this.client.query('COMMIT');
      return { revision: cloneNormalizedRevision(existing), created: false };
    } catch (error) {
      await this.client.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }

  async getRevision(revisionId: string): Promise<KeyframeDerivativeRevision | undefined> {
    return this.getRevisionInternal(revisionId);
  }

  private async getRevisionInternal(revisionId: string): Promise<KeyframeDerivativeRevision | undefined> {
    const revisionResult = await this.client.query<RevisionRow>(
      `SELECT revision_id, schema_version, derivative_id,
              scene_set_id, scene_set_revision_id, scene_id,
              source_asset_id, source_stream_id, source_stream_index,
              source_time_base_numerator, source_time_base_denominator,
              derivative_profile_version, toolchain_name, toolchain_version, created_at
         FROM keyframe_derivative_revisions
        WHERE revision_id = $1`,
      [revisionId],
    );
    const row = revisionResult.rows[0];
    if (!row) return undefined;

    const frameResult = await this.client.query<FrameRow>(
      `SELECT frame_id, source_pts, artifact_uri
         FROM keyframe_derivative_frames
        WHERE revision_id = $1
        ORDER BY ordinal ASC`,
      [revisionId],
    );

    const revision: KeyframeDerivativeRevision = {
      schemaVersion: row.schema_version,
      derivativeId: row.derivative_id,
      revisionId: row.revision_id,
      source: {
        sceneSetId: row.scene_set_id,
        sceneSetRevisionId: row.scene_set_revision_id,
        sceneId: row.scene_id,
        assetId: row.source_asset_id,
        streamId: row.source_stream_id,
        streamIndex: parseSafeInteger(row.source_stream_index, 'source_stream_index'),
        timeBase: normalizeCanonicalRational({
          numerator: parseSafeInteger(row.source_time_base_numerator, 'source_time_base_numerator'),
          denominator: parseSafeInteger(row.source_time_base_denominator, 'source_time_base_denominator'),
        }),
      },
      derivativeProfileVersion: row.derivative_profile_version,
      toolchain: {
        name: row.toolchain_name,
        version: row.toolchain_version,
      },
      createdAt: row.created_at,
      frames: frameResult.rows.map((frame) => ({
        frameId: frame.frame_id,
        sourcePts: parseSafeInteger(frame.source_pts, 'source_pts'),
        artifactUri: frame.artifact_uri,
      })),
    };
    assertValidRevision(revision);
    return cloneNormalizedRevision(revision);
  }
}

function assertValidRevision(candidate: KeyframeDerivativeRevision): void {
  const validation = validateKeyframeDerivativeRevision(candidate);
  if (!validation.valid) {
    throw new KeyframeDerivativePersistenceInvariantError(validation.errors.join('; '));
  }
}

function cloneNormalizedRevision(revision: KeyframeDerivativeRevision): KeyframeDerivativeRevision {
  const timeBase = normalizeCanonicalRational(revision.source.timeBase);
  return {
    ...revision,
    source: {
      ...revision.source,
      timeBase: { ...timeBase },
    },
    toolchain: { ...revision.toolchain },
    frames: revision.frames.map((frame) => ({ ...frame })),
  };
}

function parseSafeInteger(value: string | number, label: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new KeyframeDerivativePersistenceInvariantError(`${label} exceeds JavaScript safe-integer range`);
  }
  return parsed;
}
