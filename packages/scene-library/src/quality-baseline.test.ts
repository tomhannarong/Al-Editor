import { describe, expect, it } from 'vitest';

import {
  SCENE_SET_SCHEMA_VERSION,
  type SceneSetRevision,
} from '../../contracts/src/scene-set.contract.js';
import {
  SCENE_BOUNDARY_QUALITY_BASELINE_SCHEMA_VERSION,
  SceneBoundaryQualityBaselineError,
  evaluateSceneBoundaryQuality,
  type SceneBoundaryQualityBenchmark,
} from './quality-baseline.js';

const source = {
  assetId: `sha256:${'a'.repeat(64)}`,
  streamId: `sha256:${'a'.repeat(64)}:stream:0`,
  streamIndex: 0,
  timeBase: { numerator: 1, denominator: 90000 },
};

function sceneSet(): SceneSetRevision {
  return {
    schemaVersion: SCENE_SET_SCHEMA_VERSION,
    sceneSetId: 'scene-set:quality-baseline',
    revisionId: 'scene-set-revision:quality-baseline-v1',
    source,
    detectorVersion: 'shot-detector/baseline-1.0.0',
    createdAt: '2026-08-26T00:00:00.000Z',
    scenes: [
      { sceneId: 'scene-001', sourceStartPts: 0, sourceEndPts: 90000 },
      { sceneId: 'scene-002', sourceStartPts: 90000, sourceEndPts: 181000 },
      { sceneId: 'scene-003', sourceStartPts: 181000, sourceEndPts: 270000 },
      { sceneId: 'scene-004', sourceStartPts: 270000, sourceEndPts: 450000 },
      { sceneId: 'scene-005', sourceStartPts: 450000, sourceEndPts: 540000 },
    ],
  };
}

function benchmark(overrides: Partial<SceneBoundaryQualityBenchmark> = {}): SceneBoundaryQualityBenchmark {
  return {
    schemaVersion: SCENE_BOUNDARY_QUALITY_BASELINE_SCHEMA_VERSION,
    benchmarkId: 'phase2-scene-boundary-baseline',
    benchmarkVersion: '1.0.0',
    source,
    tolerancePts: 1500,
    expectedBoundaryPts: [90000, 180000, 270000, 360000],
    ...overrides,
  };
}

describe('scene-boundary quality baseline', () => {
  it('produces a deterministic native-PTS precision/recall/F1 baseline', () => {
    const report = evaluateSceneBoundaryQuality(sceneSet(), benchmark());

    expect(report).toEqual({
      schemaVersion: SCENE_BOUNDARY_QUALITY_BASELINE_SCHEMA_VERSION,
      benchmarkId: 'phase2-scene-boundary-baseline',
      benchmarkVersion: '1.0.0',
      sceneSetRevisionId: 'scene-set-revision:quality-baseline-v1',
      detectorVersion: 'shot-detector/baseline-1.0.0',
      tolerancePts: 1500,
      expectedBoundaryCount: 4,
      actualBoundaryCount: 4,
      matchedBoundaryCount: 3,
      precision: 0.75,
      recall: 0.75,
      f1: 0.75,
      matches: [
        { expectedPts: 90000, actualPts: 90000, deltaPts: 0 },
        { expectedPts: 180000, actualPts: 181000, deltaPts: 1000 },
        { expectedPts: 270000, actualPts: 270000, deltaPts: 0 },
      ],
    });
  });

  it('accepts semantically equivalent rational source time bases', () => {
    const report = evaluateSceneBoundaryQuality(sceneSet(), benchmark({
      source: { ...source, timeBase: { numerator: 2, denominator: 180000 } },
    }));

    expect(report.matchedBoundaryCount).toBe(3);
  });

  it('fails closed when the labeled benchmark targets a different source', () => {
    expect(() => evaluateSceneBoundaryQuality(sceneSet(), benchmark({
      source: { ...source, streamIndex: 1, streamId: `sha256:${'a'.repeat(64)}:stream:1` },
    }))).toThrow(SceneBoundaryQualityBaselineError);
  });

  it('rejects ambiguous benchmark boundaries before measuring quality', () => {
    expect(() => evaluateSceneBoundaryQuality(sceneSet(), benchmark({
      expectedBoundaryPts: [90000, 90000],
    }))).toThrow('expectedBoundaryPts must be strictly increasing');
  });
});
