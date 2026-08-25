import { describe, expect, it } from 'vitest';

import {
  KEYFRAME_DERIVATIVE_SCHEMA_VERSION,
  sameKeyframeDerivativeSource,
  validateKeyframeDerivativeRevision,
  type KeyframeDerivativeRevision,
} from './keyframe-derivative.contract.js';

const ASSET_ID = `sha256:${'c'.repeat(64)}`;

function validKeyframes(): KeyframeDerivativeRevision {
  return {
    schemaVersion: KEYFRAME_DERIVATIVE_SCHEMA_VERSION,
    derivativeId: 'keyframes:scene-001',
    revisionId: 'keyframes-revision:v1',
    source: {
      sceneSetId: 'scene-set:asset-c:stream-0',
      sceneSetRevisionId: 'scene-set-revision:v4',
      sceneId: 'scene-001',
      assetId: ASSET_ID,
      streamId: `${ASSET_ID}:stream:0`,
      streamIndex: 0,
      timeBase: { numerator: 1, denominator: 90_000 },
    },
    derivativeProfileVersion: 'keyframe-profile/1.0.0',
    toolchain: { name: 'ffmpeg', version: '6.1.1' },
    createdAt: '2026-08-25T18:00:00.000Z',
    frames: [
      { frameId: 'kf-001', sourcePts: 90_000, artifactUri: 'file:///derived/keyframes/scene-001/kf-001.jpg' },
      { frameId: 'kf-002', sourcePts: 135_000, artifactUri: 'file:///derived/keyframes/scene-001/kf-002.jpg' },
    ],
  };
}

describe('keyframe derivative contract', () => {
  it('accepts versioned rebuildable keyframes bound to immutable scene/source authority', () => {
    expect(validateKeyframeDerivativeRevision(validKeyframes())).toEqual({ valid: true, errors: [] });
  });

  it('requires explicit profile/toolchain versions and exact scene lineage', () => {
    const derivative = validKeyframes();
    derivative.derivativeProfileVersion = '';
    derivative.toolchain = { name: '', version: '' };
    derivative.source.sceneSetRevisionId = '';
    derivative.source.sceneId = '';

    const result = validateKeyframeDerivativeRevision(derivative);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('derivativeProfileVersion is required');
    expect(result.errors).toContain('toolchain.name is required');
    expect(result.errors).toContain('toolchain.version is required');
    expect(result.errors).toContain('source.sceneSetRevisionId is required');
    expect(result.errors).toContain('source.sceneId is required');
  });

  it('rejects mutable-path source identity and invalid native stream mapping', () => {
    const derivative = validKeyframes();
    derivative.source = {
      ...derivative.source,
      assetId: '/camera/DCIM/clip.mov',
      streamId: '',
      streamIndex: -1,
      timeBase: { numerator: 0, denominator: 1 },
    };

    const result = validateKeyframeDerivativeRevision(derivative);
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('canonical sha256 asset identity');
    expect(result.errors.join('\n')).toContain('source.streamId is required');
    expect(result.errors.join('\n')).toContain('source.streamIndex must be a non-negative safe integer');
    expect(result.errors.join('\n')).toContain('invalid source.timeBase');
  });

  it('keeps native sourcePts ordered/unique and rejects derived filename-only timing', () => {
    const derivative = validKeyframes();
    derivative.frames = [
      { frameId: 'kf-001', sourcePts: 90_000.5, artifactUri: 'file:///derived/keyframes/frame-at-1.000s.jpg' },
      { frameId: 'kf-001', sourcePts: 90_000, artifactUri: '' },
      { frameId: 'kf-003', sourcePts: 90_000, artifactUri: 'file:///derived/keyframes/frame-at-1.000s-duplicate.jpg' },
    ];

    const result = validateKeyframeDerivativeRevision(derivative);
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('sourcePts must be a safe integer');
    expect(result.errors.join('\n')).toContain('duplicate frameId kf-001');
    expect(result.errors.join('\n')).toContain('duplicate sourcePts 90000');
    expect(result.errors.join('\n')).toContain('artifactUri is required');
  });

  it('compares immutable source authority independently from keyframe selection and artifact state', () => {
    const source = validKeyframes().source;
    expect(sameKeyframeDerivativeSource(source, {
      ...source,
      timeBase: { numerator: 2, denominator: 180_000 },
    })).toBe(true);
    expect(sameKeyframeDerivativeSource(source, {
      ...source,
      sceneId: 'scene-002',
    })).toBe(false);
  });

  it('requires at least one extracted keyframe', () => {
    const derivative = validKeyframes();
    derivative.frames = [];
    expect(validateKeyframeDerivativeRevision(derivative).errors).toContain('frames must contain at least one keyframe');
  });
});
