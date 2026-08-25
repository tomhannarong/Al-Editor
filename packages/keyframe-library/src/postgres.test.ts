import { describe, expect, it } from 'vitest';

import type { KeyframeDerivativeRevision } from '../../contracts/src/keyframe-derivative.contract.js';
import type { PostgresQueryClient, PostgresQueryResult } from '../../media-catalog/src/postgres.js';
import { KeyframeDerivativePersistenceInvariantError } from './index.js';
import { PostgresKeyframeDerivativeRevisionStore } from './postgres.js';

const digest = 'e'.repeat(64);
const revision: KeyframeDerivativeRevision = {
  schemaVersion: '1.0',
  derivativeId: 'keyframes-a',
  revisionId: 'keyframes-a:r1',
  source: {
    sceneSetId: 'scene-set-a',
    sceneSetRevisionId: 'scene-set-a:r1',
    sceneId: 'scene-a',
    assetId: `sha256:${digest}`,
    streamId: `sha256:${digest}:stream:0`,
    streamIndex: 0,
    timeBase: { numerator: 1, denominator: 90000 },
  },
  derivativeProfileVersion: 'keyframe-profile/v1',
  toolchain: { name: 'ffmpeg', version: '7.0.2' },
  createdAt: '2026-08-25T19:20:00.000Z',
  frames: [
    { frameId: 'kf-1', sourcePts: 9000, artifactUri: 'file:///derived/keyframes-a-r1/kf-1.jpg' },
    { frameId: 'kf-2', sourcePts: 45000, artifactUri: 'file:///derived/keyframes-a-r1/kf-2.jpg' },
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
    derivative_id: candidate.derivativeId,
    scene_set_id: candidate.source.sceneSetId,
    scene_set_revision_id: candidate.source.sceneSetRevisionId,
    scene_id: candidate.source.sceneId,
    source_asset_id: candidate.source.assetId,
    source_stream_id: candidate.source.streamId,
    source_stream_index: candidate.source.streamIndex,
    source_time_base_numerator: 1,
    source_time_base_denominator: 90000,
    derivative_profile_version: candidate.derivativeProfileVersion,
    toolchain_name: candidate.toolchain.name,
    toolchain_version: candidate.toolchain.version,
    created_at: candidate.createdAt,
  };
}

function frameRows(candidate = revision) {
  return candidate.frames.map((frame) => ({
    frame_id: frame.frameId,
    source_pts: frame.sourcePts,
    artifact_uri: frame.artifactUri,
  }));
}

describe('PostgresKeyframeDerivativeRevisionStore', () => {
  it('validates before opening a transaction', async () => {
    const client = new ScriptedClient(() => ({ rows: [], rowCount: 0 }));
    const store = new PostgresKeyframeDerivativeRevisionStore(client);
    const invalid = { ...revision, frames: [{ ...revision.frames[0]!, sourcePts: 1.5 }] };

    await expect(store.registerRevision(invalid)).rejects.toBeInstanceOf(KeyframeDerivativePersistenceInvariantError);
    expect(client.calls).toEqual([]);
  });

  it('inserts the immutable revision and ordered frame evidence transactionally with normalized source time base', async () => {
    const client = new ScriptedClient((text) => {
      if (text.includes('RETURNING revision_id')) return { rows: [{ revision_id: revision.revisionId }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const store = new PostgresKeyframeDerivativeRevisionStore(client);
    const equivalent = {
      ...revision,
      source: { ...revision.source, timeBase: { numerator: 2, denominator: 180000 } },
    };

    await expect(store.registerRevision(equivalent)).resolves.toEqual({ revision, created: true });
    expect(client.calls[0]?.text).toBe('BEGIN');
    expect(client.calls[1]?.values?.[9]).toBe(1);
    expect(client.calls[1]?.values?.[10]).toBe(90000);
    const frameInserts = client.calls.filter((call) => call.text.includes('INSERT INTO keyframe_derivative_frames'));
    expect(frameInserts).toHaveLength(2);
    expect(frameInserts[0]?.values).toEqual([revision.revisionId, 0, 'kf-1', 9000, revision.frames[0]?.artifactUri]);
    expect(frameInserts[1]?.values).toEqual([revision.revisionId, 1, 'kf-2', 45000, revision.frames[1]?.artifactUri]);
    expect(client.calls.at(-1)?.text).toBe('COMMIT');
  });

  it('returns an idempotent existing revision and fails closed on immutable frame conflict', async () => {
    let frames = frameRows();
    const client = new ScriptedClient((text) => {
      if (text.includes('RETURNING revision_id')) return { rows: [], rowCount: 0 };
      if (text.includes('FROM keyframe_derivative_revisions')) return { rows: [revisionRow()], rowCount: 1 };
      if (text.includes('FROM keyframe_derivative_frames')) return { rows: frames, rowCount: frames.length };
      return { rows: [], rowCount: 0 };
    });
    const store = new PostgresKeyframeDerivativeRevisionStore(client);

    await expect(store.registerRevision(revision)).resolves.toEqual({ revision, created: false });
    expect(client.calls.at(-1)?.text).toBe('COMMIT');

    frames = [{ ...frames[0]!, artifact_uri: 'file:///derived/changed.jpg' }, frames[1]!];
    await expect(store.registerRevision(revision)).rejects.toThrow('conflicts with existing immutable revision');
    expect(client.calls.at(-1)?.text).toBe('ROLLBACK');
  });

  it('reads back normalized durable revision/frame evidence defensively', async () => {
    const client = new ScriptedClient((text) => {
      if (text.includes('FROM keyframe_derivative_revisions')) {
        return { rows: [{ ...revisionRow(), source_time_base_numerator: 2, source_time_base_denominator: 180000 }], rowCount: 1 };
      }
      if (text.includes('FROM keyframe_derivative_frames')) return { rows: frameRows(), rowCount: revision.frames.length };
      return { rows: [], rowCount: 0 };
    });
    const store = new PostgresKeyframeDerivativeRevisionStore(client);

    const first = await store.getRevision(revision.revisionId);
    expect(first).toEqual(revision);
    first!.frames[0]!.artifactUri = 'mutated';
    first!.toolchain.version = 'mutated';
    first!.source.timeBase.denominator = 1;
    await expect(store.getRevision(revision.revisionId)).resolves.toEqual(revision);
  });
});
