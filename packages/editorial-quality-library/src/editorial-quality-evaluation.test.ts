import { describe, expect, it } from 'vitest';

import {
  EDITORIAL_QUALITY_EVALUATION_POLICY_REVISION,
  EditorialQualityEvaluationInvariantError,
  compareEditorialQualityV1,
  measureEditorialQualityV1,
  type EditorialPlanEvidenceV1,
} from './editorial-quality-evaluation.js';
import type { EditorialStyleProfileV1 } from '../../contracts/src/editorial-style-profile.contract.js';

const PHASE8_EDITORIAL_QUALITY_BASELINE_REVISION =
  'phase8-editorial-quality-baseline:v1' as const;

const styleProfile: EditorialStyleProfileV1 = {
  schemaVersion: '1.0',
  profileId: 'travel-soft-v1',
  profileVersion: '1.0.0',
  status: 'approved',
  brandAuthority: {
    brandId: 'brand-1',
    brandVersion: 'v1',
    videoStyleDnaDocument: { documentId: 'video-style-dna', version: 'v1' },
  },
  duration: {
    targetShotDurationMs: 2000,
    hookShotDurationMs: 1000,
    minShotDurationMs: 500,
    maxShotDurationMs: 3000,
  },
  variety: {
    maxConsecutiveSameShotType: 2,
    preferredHumanPresenceIntervalMs: 5000,
    penalizeNearDuplicates: true,
  },
  movement: {
    movementPreferenceWeight: 0.5,
    repeatedMovementPenaltyWeight: 0.5,
  },
  transitions: { hardCutWeight: 1, maxNonCutTransitionRatio: 0.2 },
  scoring: {
    semanticRelevance: 1,
    visualQuality: 1,
    continuity: 1,
    variety: 1,
    novelty: 1,
  },
  createdAt: '2026-08-27T00:00:00.000Z',
  updatedAt: '2026-08-27T00:00:00.000Z',
};

const beforePlan: EditorialPlanEvidenceV1 = {
  schemaVersion: '1.0',
  fixtureRevisionId: 'phase8-editorial-quality-fixture:v1',
  planId: 'plan-a',
  revisionId: 'plan-a:r1',
  styleProfileId: styleProfile.profileId,
  styleProfileVersion: styleProfile.profileVersion,
  frameRate: { numerator: 30, denominator: 1 },
  shots: [
    {
      shotId: 'shot-1',
      sourceSceneId: 'scene-a',
      shotType: 'wide',
      movementType: 'static',
      continuityGroupId: 'location-a',
      startFrame: 0,
      endFrame: 90,
    },
    {
      shotId: 'shot-2',
      sourceSceneId: 'scene-a',
      shotType: 'wide',
      movementType: 'static',
      continuityGroupId: 'location-b',
      startFrame: 90,
      endFrame: 180,
    },
    {
      shotId: 'shot-3',
      sourceSceneId: 'scene-c',
      shotType: 'wide',
      movementType: 'static',
      continuityGroupId: 'location-b',
      startFrame: 180,
      endFrame: 270,
    },
  ],
};

const afterPlan: EditorialPlanEvidenceV1 = {
  ...beforePlan,
  revisionId: 'plan-a:r2',
  shots: [
    {
      shotId: 'shot-1',
      sourceSceneId: 'scene-a',
      shotType: 'wide',
      movementType: 'static',
      continuityGroupId: 'location-a',
      startFrame: 0,
      endFrame: 30,
    },
    {
      shotId: 'shot-2',
      sourceSceneId: 'scene-b',
      shotType: 'medium',
      movementType: 'pan',
      continuityGroupId: 'location-a',
      startFrame: 30,
      endFrame: 90,
    },
    {
      shotId: 'shot-3',
      sourceSceneId: 'scene-c',
      shotType: 'close',
      movementType: 'push',
      continuityGroupId: 'location-a',
      startFrame: 90,
      endFrame: 150,
    },
  ],
};

describe('editorial quality evaluation v1', () => {
  it('freezes the versioned Phase-8 control baseline before planner upgrades', () => {
    const baseline = measureEditorialQualityV1(beforePlan, styleProfile);

    expect(PHASE8_EDITORIAL_QUALITY_BASELINE_REVISION).toBe(
      'phase8-editorial-quality-baseline:v1',
    );
    expect(baseline.fixtureRevisionId).toBe('phase8-editorial-quality-fixture:v1');
    expect(baseline.planRevisionId).toBe('plan-a:r1');
    expect(baseline.evaluationPolicyRevision).toBe(
      EDITORIAL_QUALITY_EVALUATION_POLICY_REVISION,
    );
    expect(baseline.styleProfileId).toBe('travel-soft-v1');
    expect(baseline.styleProfileVersion).toBe('1.0.0');
    expect(baseline.shotCount).toBe(3);
    expect(baseline.pacingScore).toBeCloseTo(11 / 18);
    expect(baseline.pacingWithinBoundsRate).toBe(1);
    expect(baseline.continuityScore).toBe(0.5);
    expect(baseline.varietyScore).toBe(0);
    expect(baseline.shotTypeChangeRate).toBe(0);
    expect(baseline.movementChangeRate).toBe(0);
    expect(baseline.repeatRate).toBeCloseTo(1 / 3);
    expect(baseline.repeatedShotCount).toBe(1);
  });

  it('measures pacing, continuity, variety and repeat rate deterministically', () => {
    const before = measureEditorialQualityV1(beforePlan, styleProfile);
    const after = measureEditorialQualityV1(afterPlan, styleProfile);

    expect(before.evaluationPolicyRevision).toBe(EDITORIAL_QUALITY_EVALUATION_POLICY_REVISION);
    expect(before.pacingScore).toBeCloseTo(11 / 18);
    expect(before.pacingWithinBoundsRate).toBe(1);
    expect(before.continuityScore).toBe(0.5);
    expect(before.varietyScore).toBe(0);
    expect(before.repeatRate).toBeCloseTo(1 / 3);

    expect(after.pacingScore).toBe(1);
    expect(after.pacingWithinBoundsRate).toBe(1);
    expect(after.continuityScore).toBe(1);
    expect(after.varietyScore).toBe(1);
    expect(after.repeatRate).toBe(0);
  });

  it('compares only exact same-fixture/style measurements and reports directional deltas', () => {
    const comparison = compareEditorialQualityV1(
      measureEditorialQualityV1(beforePlan, styleProfile),
      measureEditorialQualityV1(afterPlan, styleProfile),
    );

    expect(comparison.fixtureRevisionId).toBe('phase8-editorial-quality-fixture:v1');
    expect(comparison.pacingDelta).toBeCloseTo(7 / 18);
    expect(comparison.continuityDelta).toBe(0.5);
    expect(comparison.varietyDelta).toBe(1);
    expect(comparison.repeatRateDelta).toBeCloseTo(-1 / 3);
    expect(comparison.pacingImproved).toBe(true);
    expect(comparison.continuityImproved).toBe(true);
    expect(comparison.varietyImproved).toBe(true);
    expect(comparison.repeatRateLowered).toBe(true);
  });

  it('rejects mismatched style authority and malformed canonical frame intervals', () => {
    expect(() =>
      measureEditorialQualityV1(
        { ...beforePlan, styleProfileVersion: 'other' },
        styleProfile,
      ),
    ).toThrow(EditorialQualityEvaluationInvariantError);

    const malformed: EditorialPlanEvidenceV1 = {
      ...beforePlan,
      shots: [
        { ...beforePlan.shots[0]!, endFrame: 30 },
        { ...beforePlan.shots[1]!, startFrame: 20, endFrame: 60 },
      ],
    };
    expect(() => measureEditorialQualityV1(malformed, styleProfile)).toThrow(
      /ordered and non-overlapping/,
    );
  });

  it('rejects before/after comparisons across fixture revisions', () => {
    const before = measureEditorialQualityV1(beforePlan, styleProfile);
    const after = measureEditorialQualityV1(
      { ...afterPlan, fixtureRevisionId: 'other-fixture' },
      styleProfile,
    );
    expect(() => compareEditorialQualityV1(before, after)).toThrow(
      /exact same fixture revision/,
    );
  });
});
