import { describe, expect, it } from 'vitest';
import {
  evaluateTemporalLightweightBaselineV1,
  validateTemporalLightweightBaselineFixtureV1,
  type TemporalLightweightBaselineFixtureV1,
} from './lightweight-baseline.js';
import { PHASE11_LIGHTWEIGHT_TEMPORAL_BASELINE_FIXTURE_V1 } from './phase11-lightweight-baseline.fixture.js';

function mutableFixture(): TemporalLightweightBaselineFixtureV1 {
  return structuredClone(PHASE11_LIGHTWEIGHT_TEMPORAL_BASELINE_FIXTURE_V1);
}

describe('Phase-11 lightweight temporal baseline', () => {
  it('freezes a valid pinned native-PTS fixture', () => {
    expect(validateTemporalLightweightBaselineFixtureV1(PHASE11_LIGHTWEIGHT_TEMPORAL_BASELINE_FIXTURE_V1)).toEqual({ valid: true, errors: [] });
  });

  it('evaluates exact deterministic control quality on the frozen fixture', () => {
    const result = evaluateTemporalLightweightBaselineV1(PHASE11_LIGHTWEIGHT_TEMPORAL_BASELINE_FIXTURE_V1);
    expect(result).toMatchObject({
      benchmarkId: 'temporal-benchmark:phase11',
      benchmarkRevisionId: 'temporal-benchmark:phase11:r1',
      fixtureRevisionId: 'temporal-fixture:lightweight-control:r1',
      approachId: 'lightweight-scene-retrieval-control',
      approachRevisionId: 'lightweight-scene-retrieval-control:r1',
      caseCount: 3,
      expectedSceneCount: 6,
      rankedSceneCount: 10,
    });
    expect(result.quality).toEqual([
      { metricId: 'temporal-recall-at-10', direction: 'higher-is-better', value: 5 / 6 },
      { metricId: 'ordered-sequence-completion-rate', direction: 'higher-is-better', value: 2 / 3 },
      { metricId: 'duplicate-occupancy', direction: 'lower-is-better', value: 1 / 10 },
    ]);
    expect(evaluateTemporalLightweightBaselineV1(PHASE11_LIGHTWEIGHT_TEMPORAL_BASELINE_FIXTURE_V1)).toEqual(result);
  });

  it('fails closed on mutable revision aliases, unsafe native timing and unknown scene references', () => {
    const candidate = mutableFixture();
    candidate.benchmarkRevisionId = 'latest';
    candidate.scenes[0]!.sourceEndPts = Number.MAX_SAFE_INTEGER + 1;
    candidate.cases[0]!.lightweightRankingSceneRevisionIds = ['scene:missing:r1'];
    const validation = validateTemporalLightweightBaselineFixtureV1(candidate);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('benchmarkRevisionId must be pinned');
    expect(validation.errors).toContain('scenes[0] must have a safe increasing native PTS range');
    expect(validation.errors).toContain('cases[0] references unknown ranked scene scene:missing:r1');
  });

  it('requires temporal labels to share lineage and remain source ordered', () => {
    const lineage = mutableFixture();
    lineage.cases[0]!.expectedOrderedSceneRevisionIds = ['scene:a2:r1', 'scene:b3:r1'];
    expect(validateTemporalLightweightBaselineFixtureV1(lineage).errors).toContain('case case:continue-a expected scenes must share exact asset/stream lineage');

    const overlap = mutableFixture();
    overlap.cases[0]!.expectedOrderedSceneRevisionIds = ['scene:a1-overlap:r1', 'scene:a2:r1'];
    expect(validateTemporalLightweightBaselineFixtureV1(overlap).errors).toContain('case case:continue-a expected scenes must be non-overlapping and source-ordered');
  });

  it('measures sequence order separately from recall', () => {
    const candidate = mutableFixture();
    candidate.cases[1]!.lightweightRankingSceneRevisionIds = ['scene:b3:r1', 'scene:b2:r1', 'scene:c1:r1'];
    const result = evaluateTemporalLightweightBaselineV1(candidate);
    expect(result.quality[0]!.value).toBe(5 / 6);
    expect(result.quality[1]!.value).toBe(1 / 3);
  });
});
