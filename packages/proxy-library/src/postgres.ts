import { normalizeCanonicalRational } from '../../contracts/src/canonical-timeline.contract.js';
import {
  validateProxyDerivativeRevision,
  type ProxyDerivativeRevision,
} from '../../contracts/src/proxy-derivative.contract.js';
import type { PostgresQueryClient } from '../../media-catalog/src/postgres.js';
import {
  ProxyDerivativePersistenceInvariantError,
  sameImmutableProxyDerivativeRevision,
  type RegisterProxyDerivativeRevisionResult,
} from './index.js';

type RevisionRow = {
  revision_id: string;
  schema_version: ProxyDerivativeRevision['schemaVersion'];
  derivative_id: string;
  scene_set_id: string;
  scene_set_revision_id: string;
  source_asset_id: string;
  source_stream_id: string;
  source_stream_index: string | number;
  source_time_base_numerator: string | number;
  source_time_base_denominator: string | number;
  derivative_profile_version: string;
  toolchain_name: string;
  toolchain_version: string;
  artifact_uri: string;
  created_at: string;
};

/**
 * Durable PostgreSQL boundary for immutable proxy derivative revision evidence.
 * The referenced scene-set/source tuple is enforced by migration-level foreign
 * keys; artifactUri remains rebuildable derivative state, never timing/source authority.
 */
export class PostgresProxyDerivativeRevisionStore {
  constructor(private readonly client: PostgresQueryClient) {}

  async registerRevision(candidate: ProxyDerivativeRevision): Promise<RegisterProxyDerivativeRevisionResult> {
    assertValidRevision(candidate);
    const normalized = cloneNormalizedRevision(candidate);

    await this.client.query('BEGIN');
    try {
      const inserted = await this.client.query<{ revision_id: string }>(
        `INSERT INTO proxy_derivative_revisions (
           revision_id, schema_version, derivative_id,
           scene_set_id, scene_set_revision_id,
           source_asset_id, source_stream_id, source_stream_index,
           source_time_base_numerator, source_time_base_denominator,
           derivative_profile_version, toolchain_name, toolchain_version,
           artifact_uri, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (revision_id) DO NOTHING
         RETURNING revision_id`,
        [
          normalized.revisionId,
          normalized.schemaVersion,
          normalized.derivativeId,
          normalized.source.sceneSetId,
          normalized.source.sceneSetRevisionId,
          normalized.source.assetId,
          normalized.source.streamId,
          normalized.source.streamIndex,
          normalized.source.timeBase.numerator,
          normalized.source.timeBase.denominator,
          normalized.derivativeProfileVersion,
          normalized.toolchain.name,
          normalized.toolchain.version,
          normalized.artifactUri,
          normalized.createdAt,
        ],
      );

      if (inserted.rows[0]) {
        await this.client.query('COMMIT');
        return { revision: cloneNormalizedRevision(normalized), created: true };
      }

      const existing = await this.getRevisionInternal(normalized.revisionId);
      if (!existing) {
        throw new ProxyDerivativePersistenceInvariantError(
          'proxy derivative revision conflict disappeared before readback',
        );
      }
      if (!sameImmutableProxyDerivativeRevision(existing, normalized)) {
        throw new ProxyDerivativePersistenceInvariantError(
          `proxy derivative revisionId ${normalized.revisionId} conflicts with existing immutable revision`,
        );
      }

      await this.client.query('COMMIT');
      return { revision: cloneNormalizedRevision(existing), created: false };
    } catch (error) {
      await this.client.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }

  async getRevision(revisionId: string): Promise<ProxyDerivativeRevision | undefined> {
    return this.getRevisionInternal(revisionId);
  }

  private async getRevisionInternal(revisionId: string): Promise<ProxyDerivativeRevision | undefined> {
    const result = await this.client.query<RevisionRow>(
      `SELECT revision_id, schema_version, derivative_id,
              scene_set_id, scene_set_revision_id,
              source_asset_id, source_stream_id, source_stream_index,
              source_time_base_numerator, source_time_base_denominator,
              derivative_profile_version, toolchain_name, toolchain_version,
              artifact_uri, created_at
         FROM proxy_derivative_revisions
        WHERE revision_id = $1`,
      [revisionId],
    );
    const row = result.rows[0];
    if (!row) return undefined;

    const revision: ProxyDerivativeRevision = {
      schemaVersion: row.schema_version,
      derivativeId: row.derivative_id,
      revisionId: row.revision_id,
      source: {
        sceneSetId: row.scene_set_id,
        sceneSetRevisionId: row.scene_set_revision_id,
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
      artifactUri: row.artifact_uri,
      createdAt: row.created_at,
    };
    assertValidRevision(revision);
    return cloneNormalizedRevision(revision);
  }
}

function assertValidRevision(candidate: ProxyDerivativeRevision): void {
  const validation = validateProxyDerivativeRevision(candidate);
  if (!validation.valid) {
    throw new ProxyDerivativePersistenceInvariantError(validation.errors.join('; '));
  }
}

function cloneNormalizedRevision(revision: ProxyDerivativeRevision): ProxyDerivativeRevision {
  const timeBase = normalizeCanonicalRational(revision.source.timeBase);
  return {
    ...revision,
    source: {
      ...revision.source,
      timeBase: { ...timeBase },
    },
    toolchain: { ...revision.toolchain },
  };
}

function parseSafeInteger(value: string | number, label: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new ProxyDerivativePersistenceInvariantError(`${label} exceeds JavaScript safe-integer range`);
  }
  return parsed;
}
