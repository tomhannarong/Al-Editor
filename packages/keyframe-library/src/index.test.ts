import { describe, expect, it } from 'vitest';

import {
  KEYFRAME_DERIVATIVE_SCHEMA_VERSION,
  type KeyframeDerivativeRevision,
} from '../../contracts/src/keyframe-derivative.contract.js';
import {
  InMemoryKeyframeDerivativeRevisionStore,
  KeyframeDerivativePersistenceInvariantError,
  sameImmutableKeyframeDerivativeRevision,
} from './index.js';

const ASSET_ID = `sha256:${'d'.repeat(64)}`;

function validRevision(overrides: Partial<KeyframeDerivativeRevision> = {}): KeyframeDerivativeRevision {
  return {
    schemaVersion: KEYFRAME_DERIVATIVE_SCHEMA_VERSION,
    derivativeId: 'keyframes:scene-set:asset-d:scene-1',
    revisionId: 'keyframe-revision:v1',
    source: {
      sceneSetId: 'scene-set:asset-d:stream-0',
      sceneSetRevisionId: 'scene-set-revision:v4',
      sceneId: 'scene-1',
      assetId: ASSET_ID,
      streamId: `${ASSET_ID}:stream:0`,
      streamIndex: 0,
      timeBase: { numerator: 1, denominator: 90_000 },
    },
    derivativeProfileVersion: 'keyframe-profile/1.0.0',
    toolchain: { name: 'ffmpeg', version: '6.1.1' },
    createdAt: '2026-08-26T01:00:00.000Z',
    frames: [
      {
        frameId: 'frame-1',
        sourcePts: 90_000,
        artifactUri: 'file:///derived/keyframes/frame-1.jpg',
      },
      {
        frameId: 'frame-2',
        sourcePts: 180_000,
        artifactUri: 'file:///derived/keyframes/frame-2.jpg',
      },
    ],
    ...overrides,
  };
}

describe('keyframe derivative revision persistence', () => {
  it('registers immutable keyframe evidence and returns deep defensive copies', () => {
    const store = new InMemoryKeyframeDerivativeRevisionStore();
    const candidate = validRevision();

    const first = store.registerRevision(candidate);
    expect(first.created).toBe(true);
    expect(first.revision.source.timeBase).toEqual({ numerator: 1, denominator: 90_000 });

    first.revision.source.streamId = 'mutated';
    first.revision.toolchain.version = 'mutated';
    first.revision.frames[0]!.sourcePts = 123;
    first.revision.frames[0]!.artifactUri = 'file:///mutated.jpg';

    expect(store.getRevision(candidate.revisionId)).toEqual(validRevision());
  });

  it('treats semantic re-registration with an equivalent rational time base as idempotent', () => {
    const store = new InMemoryKeyframeDerivativeRevisionStore();
    expect(store.registerRevision(validRevision()).created).toBe(true);

    const equivalent = validRevision();
    equivalent.source.timeBase = { numerator: 2, denominator: 180_000 };

    const result = store.registerRevision(equivalent);
    expect(result.created).toBe(false);
    expect(result.revision.source.timeBase).toEqual({ numerator: 1, denominator: 90_000 });
  });

  it('fails closed when revisionId is reused with changed source lineage', () => {
    const store = new InMemoryKeyframeDerivativeRevisionStore();
    store.registerRevision(validRevision());

    const conflict = validRevision();
    conflict.source = { ...conflict.source, sceneId: 'scene-2' };

    expect(() => store.registerRevision(conflict)).toThrow(KeyframeDerivativePersistenceInvariantError);
    expect(store.getRevision('keyframe-revision:v1')?.source.sceneId).toBe('scene-1');
  });

  it('fails closed when frame selection or derivative artifact evidence changes under the same revisionId', () => {
    const store = new InMemoryKeyframeDerivativeRevisionStore();
    store.registerRevision(validRevision());

    const changedPts = validRevision();
    changedPts.frames = changedPts.frames.map((frame, index) => index === 1
      ? { ...frame, sourcePts: 270_000 }
      : frame);
    expect(() => store.registerRevision(changedPts)).toThrow(KeyframeDerivativePersistenceInvariantError);

    const changedArtifact = validRevision();
    changedArtifact.frames = changedArtifact.frames.map((frame, index) => index === 0
      ? { ...frame, artifactUri: 'file:///derived/keyframes/rebuilt-frame-1.jpg' }
      : frame);
    expect(() => store.registerRevision(changedArtifact)).toThrow(KeyframeDerivativePersistenceInvariantError);

    expect(store.getRevision('keyframe-revision:v1')).toEqual(validRevision());
  });

  it('requires a new revision for rebuilt frame evidence and preserves the historical revision', () => {
    const store = new InMemoryKeyframeDerivativeRevisionStore();
    store.registerRevision(validRevision());

    const rebuilt = validRevision({
      revisionId: 'keyframe-revision:v2',
      createdAt: '2026-08-26T01:05:00.000Z',
      frames: [
        {
          frameId: 'frame-1b',
          sourcePts: 90_000,
          artifactUri: 'file:///derived/keyframes/v2/frame-1.jpg',
        },
        {
          frameId: 'frame-2b',
          sourcePts: 180_000,
          artifactUri: 'file:///derived/keyframes/v2/frame-2.jpg',
        },
      ],
    });

    expect(store.registerRevision(rebuilt).created).toBe(true);
    expect(store.getRevision('keyframe-revision:v1')?.frames[0]?.artifactUri)
      .toBe('file:///derived/keyframes/frame-1.jpg');
    expect(store.getRevision('keyframe-revision:v2')?.frames[0]?.artifactUri)
      .toBe('file:///derived/keyframes/v2/frame-1.jpg');
  });

  it('rejects invalid evidence before persistence and compares complete immutable revision semantics', () => {
    const store = new InMemoryKeyframeDerivativeRevisionStore();
    const invalid = validRevision({ derivativeProfileVersion: '' });

    expect(() => store.registerRevision(invalid)).toThrow(KeyframeDerivativePersistenceInvariantError);
    expect(store.getRevision(invalid.revisionId)).toBeUndefined();

    const left = validRevision();
    const right = validRevision();
    right.toolchain = { ...right.toolchain, version: '7.0.0' };
    expect(sameImmutableKeyframeDerivativeRevision(left, right)).toBe(false);
  });
});
