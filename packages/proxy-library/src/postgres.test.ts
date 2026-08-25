import { describe, expect, it } from 'vitest';

import type { ProxyDerivativeRevision } from '../../contracts/src/proxy-derivative.contract.js';
import type { PostgresQueryClient, PostgresQueryResult } from '../../media-catalog/src/postgres.js';
import { ProxyDerivativePersistenceInvariantError } from './index.js';
import { PostgresProxyDerivativeRevisionStore } from './postgres.js';

const digest = 'f'.repeat(64);
const revision: ProxyDerivativeRevision = {
  schemaVersion: '1.0',
  derivativeId: 'proxy-a',
  revisionId: 'proxy-a:r1',
  source: {
    sceneSetId: 'scene-set-a',
    sceneSetRevisionId: 'scene-set-a:r1',
    assetId: `sha256:${digest}`,
    streamId: `sha256:${digest}:stream:0`,
    streamIndex: 0,
    timeBase: { numerator: 1, denominator: 90000 },
  },
  derivativeProfileVersion: 'proxy-profile/v1',
  toolchain: { name: 'ffmpeg', version: '7.0.2' },
  artifactUri: 'file:///derived/proxy-a-r1.mp4',
  createdAt: '2026-08-25T15:30:00.000Z',
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

function rowFromRevision(candidate = revision) {
  return {
    revision_id: candidate.revisionId,
    schema_version: candidate.schemaVersion,
    derivative_id: candidate.derivativeId,
    scene_set_id: candidate.source.sceneSetId,
    scene_set_revision_id: candidate.source.sceneSetRevisionId,
    source_asset_id: candidate.source.assetId,
    source_stream_id: candidate.source.streamId,
    source_stream_index: candidate.source.streamIndex,
    source_time_base_numerator: 1,
    source_time_base_denominator: 90000,
    derivative_profile_version: candidate.derivativeProfileVersion,
    toolchain_name: candidate.toolchain.name,
    toolchain_version: candidate.toolchain.version,
    artifact_uri: candidate.artifactUri,
    created_at: candidate.createdAt,
  };
}

describe('PostgresProxyDerivativeRevisionStore', () => {
  it('validates before opening a transaction', async () => {
    const client = new ScriptedClient(() => ({ rows: [], rowCount: 0 }));
    const store = new PostgresProxyDerivativeRevisionStore(client);
    const invalid = { ...revision, source: { ...revision.source, streamIndex: -1 } };

    await expect(store.registerRevision(invalid)).rejects.toBeInstanceOf(ProxyDerivativePersistenceInvariantError);
    expect(client.calls).toEqual([]);
  });

  it('inserts one immutable derivative revision transactionally with normalized source time base', async () => {
    const client = new ScriptedClient((text) => {
      if (text.includes('RETURNING revision_id')) return { rows: [{ revision_id: revision.revisionId }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const store = new PostgresProxyDerivativeRevisionStore(client);
    const equivalent = {
      ...revision,
      source: { ...revision.source, timeBase: { numerator: 2, denominator: 180000 } },
    };

    await expect(store.registerRevision(equivalent)).resolves.toEqual({ revision, created: true });
    expect(client.calls[0]?.text).toBe('BEGIN');
    expect(client.calls[1]?.values?.[8]).toBe(1);
    expect(client.calls[1]?.values?.[9]).toBe(90000);
    expect(client.calls.at(-1)?.text).toBe('COMMIT');
  });

  it('returns an idempotent existing revision and fails closed on immutable evidence conflict', async () => {
    let existingRow = rowFromRevision();
    const client = new ScriptedClient((text) => {
      if (text.includes('RETURNING revision_id')) return { rows: [], rowCount: 0 };
      if (text.includes('FROM proxy_derivative_revisions')) return { rows: [existingRow], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const store = new PostgresProxyDerivativeRevisionStore(client);

    await expect(store.registerRevision(revision)).resolves.toEqual({ revision, created: false });
    expect(client.calls.at(-1)?.text).toBe('COMMIT');

    existingRow = { ...existingRow, artifact_uri: 'file:///derived/changed.mp4' };
    await expect(store.registerRevision(revision)).rejects.toThrow('conflicts with existing immutable revision');
    expect(client.calls.at(-1)?.text).toBe('ROLLBACK');
  });

  it('reads back normalized durable evidence defensively', async () => {
    const client = new ScriptedClient((text) => {
      if (text.includes('FROM proxy_derivative_revisions')) {
        return { rows: [{ ...rowFromRevision(), source_time_base_numerator: 2, source_time_base_denominator: 180000 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    const store = new PostgresProxyDerivativeRevisionStore(client);

    const first = await store.getRevision(revision.revisionId);
    expect(first).toEqual(revision);
    first!.toolchain.version = 'mutated';
    first!.source.timeBase.denominator = 1;
    await expect(store.getRevision(revision.revisionId)).resolves.toEqual(revision);
  });
});
