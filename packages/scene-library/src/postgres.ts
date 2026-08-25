import { normalizeCanonicalRational } from '../../contracts/src/canonical-timeline.contract.js';
import {
  validateSceneSetRevision,
  type SceneSetRevision,
} from '../../contracts/src/scene-set.contract.js';
import {
  SceneSetPersistenceInvariantError,
  sameImmutableSceneSetRevision,
  type RegisterSceneSetRevisionResult,
} from './index.js';
import type { PostgresQueryClient } from '../../media-catalog/src/postgres.js';

type RevisionRow = {
  revision_id: string;
  schema_version: SceneSetRevision['schemaVersion'];
  scene_set_id: string;
  source_asset_id: string;
  source_stream_id: string;
  source_stream_index: number;
  source_time_base_numerator: string | number;
  source_time_base_denominator: string | number;
  detector_version: string;
  created_at: string;
};

type SceneRow = {
  scene_id: string;
  source_start_pts: string | number;
  source_end_pts: string | number;
};

export class PostgresSceneSetRevisionStore {
  constructor(private readonly client: PostgresQueryClient) {}

  async registerRevision(candidate: SceneSetRevision): Promise<RegisterSceneSetRevisionResult> {
    assertValidRevision(candidate);
    const normalized = cloneNormalizedRevision(candidate);

    await this.client.query('BEGIN');
    try {
      const inserted = await this.client.query<{ revision_id: string }>(
        `INSERT INTO scene_set_revisions (
           revision_id, schema_version, scene_set_id,
           source_asset_id, source_stream_id, source_stream_index,
           source_time_base_numerator, source_time_base_denominator,
           detector_version, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (revision_id) DO NOTHING
         RETURNING revision_id`,
        [
          normalized.revisionId,
          normalized.schemaVersion,
          normalized.sceneSetId,
          normalized.source.assetId,
          normalized.source.streamId,
          normalized.source.streamIndex,
          normalized.source.timeBase.numerator,
          normalized.source.timeBase.denominator,
          normalized.detectorVersion,
          normalized.createdAt,
        ],
      );

      if (inserted.rows[0]) {
        for (const [ordinal, scene] of normalized.scenes.entries()) {
          await this.client.query(
            `INSERT INTO scene_set_intervals (
               revision_id, ordinal, scene_id, source_start_pts, source_end_pts
             ) VALUES ($1,$2,$3,$4,$5)`,
            [normalized.revisionId, ordinal, scene.sceneId, scene.sourceStartPts, scene.sourceEndPts],
          );
        }
        await this.client.query('COMMIT');
        return { revision: cloneNormalizedRevision(normalized), created: true };
      }

      const existing = await this.getRevisionInternal(normalized.revisionId);
      if (!existing) {
        throw new SceneSetPersistenceInvariantError('scene-set revision conflict disappeared before readback');
      }
      if (!sameImmutableSceneSetRevision(existing, normalized)) {
        throw new SceneSetPersistenceInvariantError(
          `scene-set revisionId ${normalized.revisionId} conflicts with existing immutable revision`,
        );
      }
      await this.client.query('COMMIT');
      return { revision: cloneNormalizedRevision(existing), created: false };
    } catch (error) {
      await this.client.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }

  async getRevision(revisionId: string): Promise<SceneSetRevision | undefined> {
    return this.getRevisionInternal(revisionId);
  }

  private async getRevisionInternal(revisionId: string): Promise<SceneSetRevision | undefined> {
    const revisionResult = await this.client.query<RevisionRow>(
      `SELECT revision_id, schema_version, scene_set_id,
              source_asset_id, source_stream_id, source_stream_index,
              source_time_base_numerator, source_time_base_denominator,
              detector_version, created_at
         FROM scene_set_revisions
        WHERE revision_id = $1`,
      [revisionId],
    );
    const row = revisionResult.rows[0];
    if (!row) return undefined;

    const scenesResult = await this.client.query<SceneRow>(
      `SELECT scene_id, source_start_pts, source_end_pts
         FROM scene_set_intervals
        WHERE revision_id = $1
        ORDER BY ordinal`,
      [revisionId],
    );

    const revision: SceneSetRevision = {
      schemaVersion: row.schema_version,
      sceneSetId: row.scene_set_id,
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
      detectorVersion: row.detector_version,
      createdAt: row.created_at,
      scenes: scenesResult.rows.map((scene) => ({
        sceneId: scene.scene_id,
        sourceStartPts: parseSafeInteger(scene.source_start_pts, 'source_start_pts'),
        sourceEndPts: parseSafeInteger(scene.source_end_pts, 'source_end_pts'),
      })),
    };
    assertValidRevision(revision);
    return cloneNormalizedRevision(revision);
  }
}

function assertValidRevision(candidate: SceneSetRevision): void {
  const validation = validateSceneSetRevision(candidate);
  if (!validation.valid) throw new SceneSetPersistenceInvariantError(validation.errors.join('; '));
}

function cloneNormalizedRevision(revision: SceneSetRevision): SceneSetRevision {
  const timeBase = normalizeCanonicalRational(revision.source.timeBase);
  return {
    ...revision,
    source: { ...revision.source, timeBase: { ...timeBase } },
    scenes: revision.scenes.map((scene) => ({ ...scene })),
  };
}

function parseSafeInteger(value: string | number, label: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new SceneSetPersistenceInvariantError(`${label} exceeds JavaScript safe-integer range`);
  }
  return parsed;
}
