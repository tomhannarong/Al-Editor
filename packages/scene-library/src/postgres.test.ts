import { describe, expect, it } from 'vitest';

import type { PostgresQueryClient, PostgresQueryResult } from '../../media-catalog/src/postgres.js';
import type { SceneSetRevision } from '../../contracts/src/scene-set.contract.js';
import { SceneSetPersistenceInvariantError } from './index.js';
import { PostgresSceneSetRevisionStore } from './postgres.js';

const digest = 'a'.repeat(64);
const revision: SceneSetRevision = {
  schemaVersion: '1.0',
  sceneSetId: 'scene-set-a',
  revisionId: 'scene-set-a:r1',
  source: {
    assetId: `sha256:${digest}`,
    streamId: `sha256:${digest}:stream:0`,
    streamIndex: 0,
    timeBase: { numerator: 1, denominator: 90000 },
  },
  detectorVersion: 'detector/v1',
  createdAt: '2026-08-25T12:00:00.000Z',
  scenes: [
    { sceneId: 'scene-1', sourceStartPts: 9000, sourceEndPts: 18000 },
    { sceneId: 'scene-2', sourceStartPts: 18000, sourceEndPts: 45000 },
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

describe('PostgresSceneSetRevisionStore', () => {
  it('validates before opening a transaction', async () => {
    const client = new ScriptedClient(() => ({ rows: [], rowCount: 0 }));
    const store = new PostgresSceneSetRevisionStore(client);
    const invalid = { ...revision, scenes: [{ sceneId: 'bad', sourceStartPts: 10, sourceEndPts: 10 }] };

    await expect(store.registerRevision(invalid)).rejects.toBeInstanceOf(SceneSetPersistenceInvariantError);
    expect(client.calls).toEqual([]);
  });

  it('inserts one immutable revision and ordered native-PTS intervals transactionally', async () => {
    const client = new ScriptedClient((text) => {
      if (text.includes('RETURNING revision_id')) return { rows: [{ revision_id: revision.revisionId }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const store = new PostgresSceneSetRevisionStore(client);

    await expect(store.registerRevision(revision)).resolves.toEqual({ revision, created: true });
    expect(client.calls[0]?.text).toBe('BEGIN');
    expect(client.calls.filter((call) => call.text.includes('INSERT INTO scene_set_intervals'))).toHaveLength(2);
    expect(client.calls.at(-1)?.text).toBe('COMMIT');
  });

  it('fails closed and rolls back conflicting revisionId reuse', async () => {
    const client = new ScriptedClient((text) => {
      if (text.includes('RETURNING revision_id')) return { rows: [], rowCount: 0 };
      if (text.includes('FROM scene_set_revisions')) {
        return {
          rows: [{
            revision_id: revision.revisionId,
            schema_version: revision.schemaVersion,
            scene_set_id: revision.sceneSetId,
            source_asset_id: revision.source.assetId,
            source_stream_id: revision.source.streamId,
            source_stream_index: revision.source.streamIndex,
            source_time_base_numerator: 1,
            source_time_base_denominator: 90000,
            detector_version: 'detector/other',
            created_at: revision.createdAt,
          }],
          rowCount: 1,
        };
      }
      if (text.includes('FROM scene_set_intervals')) {
        return { rows: revision.scenes.map((scene) => ({
          scene_id: scene.sceneId,
          source_start_pts: scene.sourceStartPts,
          source_end_pts: scene.sourceEndPts,
        })), rowCount: revision.scenes.length };
      }
      return { rows: [], rowCount: 0 };
    });
    const store = new PostgresSceneSetRevisionStore(client);

    await expect(store.registerRevision(revision)).rejects.toThrow('conflicts with existing immutable revision');
    expect(client.calls.at(-1)?.text).toBe('ROLLBACK');
  });
});
