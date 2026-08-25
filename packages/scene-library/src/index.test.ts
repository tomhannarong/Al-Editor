import { describe, expect, it } from 'vitest';

import { SCENE_SET_SCHEMA_VERSION, type SceneSetRevision } from '../../contracts/src/scene-set.contract.js';
import {
  InMemorySceneSetRevisionStore,
  SceneSetPersistenceInvariantError,
  sameImmutableSceneSetRevision,
} from './index.js';

function revision(overrides: Partial<SceneSetRevision> = {}): SceneSetRevision {
  return {
    schemaVersion: SCENE_SET_SCHEMA_VERSION,
    sceneSetId: 'scene-set:asset-a:stream-0',
    revisionId: 'scene-set-revision:001',
    source: {
      assetId: `sha256:${'a'.repeat(64)}`,
      streamId: `sha256:${'a'.repeat(64)}:stream:0`,
      streamIndex: 0,
      timeBase: { numerator: 1, denominator: 90000 },
    },
    detectorVersion: 'shot-detector/1.0.0',
    createdAt: '2026-08-25T12:00:00.000Z',
    scenes: [
      { sceneId: 'scene-001', sourceStartPts: 9000, sourceEndPts: 99000 },
      { sceneId: 'scene-002', sourceStartPts: 99000, sourceEndPts: 189000 },
    ],
    ...overrides,
  };
}

describe('immutable scene-set revision persistence', () => {
  it('registers once and treats exact semantic re-registration as idempotent', () => {
    const store = new InMemorySceneSetRevisionStore();
    const first = store.registerRevision(revision());
    const second = store.registerRevision(revision({
      source: {
        ...revision().source,
        timeBase: { numerator: 2, denominator: 180000 },
      },
    }));

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.revision.source.timeBase).toEqual({ numerator: 1, denominator: 90000 });
    expect(store.getRevision(first.revision.revisionId)).toEqual(first.revision);
  });

  it('rejects revisionId reuse when immutable source mapping changes', () => {
    const store = new InMemorySceneSetRevisionStore();
    store.registerRevision(revision());

    expect(() => store.registerRevision(revision({
      source: {
        ...revision().source,
        streamIndex: 1,
        streamId: `sha256:${'a'.repeat(64)}:stream:1`,
      },
    }))).toThrow('conflicts with existing immutable revision');
  });

  it('rejects revisionId reuse when scene intervals or detector evidence change', () => {
    const store = new InMemorySceneSetRevisionStore();
    store.registerRevision(revision());

    expect(() => store.registerRevision(revision({
      scenes: [
        { sceneId: 'scene-001', sourceStartPts: 9000, sourceEndPts: 100000 },
        { sceneId: 'scene-002', sourceStartPts: 100000, sourceEndPts: 189000 },
      ],
    }))).toThrow('conflicts with existing immutable revision');

    expect(() => store.registerRevision(revision({ detectorVersion: 'shot-detector/2.0.0' })))
      .toThrow('conflicts with existing immutable revision');
  });

  it('allows additive revisions for the same sceneSetId without mutating prior evidence', () => {
    const store = new InMemorySceneSetRevisionStore();
    const original = store.registerRevision(revision()).revision;
    const next = store.registerRevision(revision({
      revisionId: 'scene-set-revision:002',
      detectorVersion: 'shot-detector/1.1.0',
      createdAt: '2026-08-25T12:10:00.000Z',
      scenes: [
        { sceneId: 'scene-101', sourceStartPts: 9000, sourceEndPts: 108000 },
        { sceneId: 'scene-102', sourceStartPts: 108000, sourceEndPts: 189000 },
      ],
    })).revision;

    expect(next.revisionId).not.toBe(original.revisionId);
    expect(store.getRevision(original.revisionId)).toEqual(original);
    expect(store.getRevision(next.revisionId)).toEqual(next);
  });

  it('defensively copies persisted revisions so callers cannot mutate immutable evidence', () => {
    const store = new InMemorySceneSetRevisionStore();
    const created = store.registerRevision(revision()).revision;
    created.source.timeBase.numerator = 999;
    created.scenes[0]!.sourceStartPts = 123456;

    const readback = store.getRevision('scene-set-revision:001');
    expect(readback?.source.timeBase).toEqual({ numerator: 1, denominator: 90000 });
    expect(readback?.scenes[0]?.sourceStartPts).toBe(9000);
  });

  it('validates revisions before persistence side effects', () => {
    const store = new InMemorySceneSetRevisionStore();
    expect(() => store.registerRevision(revision({
      scenes: [{ sceneId: 'bad', sourceStartPts: 100, sourceEndPts: 100 }],
    }))).toThrow(SceneSetPersistenceInvariantError);
    expect(store.getRevision('scene-set-revision:001')).toBeUndefined();
  });
});

describe('sameImmutableSceneSetRevision', () => {
  it('compares exact immutable evidence while normalizing equivalent rational time bases', () => {
    const left = revision();
    const right = revision({
      source: {
        ...revision().source,
        timeBase: { numerator: 2, denominator: 180000 },
      },
    });
    expect(sameImmutableSceneSetRevision(left, right)).toBe(true);
    expect(sameImmutableSceneSetRevision(left, revision({ revisionId: 'different' }))).toBe(false);
  });
});
