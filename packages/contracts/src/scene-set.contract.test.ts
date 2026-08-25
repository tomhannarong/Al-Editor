import { describe, expect, it } from 'vitest';

import {
  SCENE_SET_SCHEMA_VERSION,
  sameSceneSourceMapping,
  validateSceneSetRevision,
  type SceneSetRevision,
} from './scene-set.contract.js';

const ASSET_ID = `sha256:${'a'.repeat(64)}`;

function validSceneSet(): SceneSetRevision {
  return {
    schemaVersion: SCENE_SET_SCHEMA_VERSION,
    sceneSetId: 'scene-set:asset-a:stream-0',
    revisionId: 'scene-set-revision:v1',
    source: {
      assetId: ASSET_ID,
      streamId: `${ASSET_ID}:stream:0`,
      streamIndex: 0,
      timeBase: { numerator: 1, denominator: 90_000 },
    },
    detectorVersion: 'shot-boundary-baseline/1.0.0',
    createdAt: '2026-08-25T11:00:00.000Z',
    scenes: [
      { sceneId: 'scene-0001', sourceStartPts: 9_000, sourceEndPts: 99_000 },
      { sceneId: 'scene-0002', sourceStartPts: 99_000, sourceEndPts: 189_000 },
    ],
  };
}

describe('scene-set contract', () => {
  it('accepts immutable versioned scene sets with exact native source mapping', () => {
    expect(validateSceneSetRevision(validSceneSet())).toEqual({ valid: true, errors: [] });
  });

  it('rejects decimal/unsafe or inverted native PTS boundaries', () => {
    const sceneSet = validSceneSet();
    sceneSet.scenes = [
      { sceneId: 'fractional', sourceStartPts: 1.5, sourceEndPts: 2 },
      { sceneId: 'inverted', sourceStartPts: 10, sourceEndPts: 9 },
    ];

    const result = validateSceneSetRevision(sceneSet);
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('sourceStartPts must be a safe integer');
    expect(result.errors.join('\n')).toContain('sourceEndPts must be greater than sourceStartPts');
  });

  it('rejects duplicate, overlapping, or out-of-order scene intervals', () => {
    const sceneSet = validSceneSet();
    sceneSet.scenes = [
      { sceneId: 'scene-a', sourceStartPts: 0, sourceEndPts: 100 },
      { sceneId: 'scene-a', sourceStartPts: 50, sourceEndPts: 150 },
    ];

    const result = validateSceneSetRevision(sceneSet);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('duplicate sceneId scene-a');
    expect(result.errors.join('\n')).toContain('overlaps or is out of source order');
  });

  it('rejects invalid source identity, stream index and rational time base', () => {
    const sceneSet = validSceneSet();
    sceneSet.source = {
      assetId: '/mutable/path/camera.mov',
      streamId: '',
      streamIndex: -1,
      timeBase: { numerator: 0, denominator: 1 },
    };

    const result = validateSceneSetRevision(sceneSet);
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('canonical sha256 asset identity');
    expect(result.errors.join('\n')).toContain('source.streamId is required');
    expect(result.errors.join('\n')).toContain('source.streamIndex must be a non-negative safe integer');
    expect(result.errors.join('\n')).toContain('invalid source.timeBase');
  });

  it('compares source mapping by immutable asset/stream identity and exact normalized rational time base', () => {
    const source = validSceneSet().source;
    expect(sameSceneSourceMapping(source, {
      ...source,
      timeBase: { numerator: 2, denominator: 180_000 },
    })).toBe(true);
    expect(sameSceneSourceMapping(source, { ...source, streamIndex: 1 })).toBe(false);
  });
});
