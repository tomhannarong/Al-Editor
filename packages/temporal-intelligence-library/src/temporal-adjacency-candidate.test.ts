import { describe, expect, it } from 'vitest';
import { validateTemporalIntelligenceBenchmarkComparisonV1 } from '../../contracts/src/temporal-intelligence-benchmark.contract.js';
import { PHASE11_LIGHTWEIGHT_TEMPORAL_BASELINE_FIXTURE_V1 } from './phase11-lightweight-baseline.fixture.js';
import {
  evaluateTemporalAdjacencyCandidateV1,
  runTemporalCandidateComparisonV1,
  temporalCandidateWinsEveryQualityMetricV1,
} from './temporal-adjacency-candidate.js';

function deterministicClock(stepNs: bigint): () => bigint {
  let now = 0n;
  return () => {
    now += stepNs;
    return now;
  };
}

describe('Phase-11 temporal adjacency candidate', () => {
  it('uses native temporal adjacency and overlap suppression to improve the frozen fixture', () => {
    const candidate = evaluateTemporalAdjacencyCandidateV1(PHASE11_LIGHTWEIGHT_TEMPORAL_BASELINE_FIXTURE_V1);

    expect(candidate.rankingsByCase['case:continue-a']).toEqual([
      'scene:a2:r1',
      'scene:a3:r1',
      'scene:a1-overlap:r1',
      'scene:b2:r1',
      'scene:b3:r1',
      'scene:c1:r1',
    ]);
    expect(candidate.rankingsByCase['case:continue-b']).toEqual([
      'scene:b2:r1',
      'scene:b3:r1',
      'scene:c1:r1',
    ]);
    expect(candidate.rankingsByCase['case:ordered-a']).toEqual([
      'scene:a1:r1',
      'scene:a2:r1',
      'scene:a3:r1',
    ]);
    expect(candidate.quality).toEqual([
      { metricId: 'temporal-recall-at-10', direction: 'higher-is-better', value: 1 },
      { metricId: 'ordered-sequence-completion-rate', direction: 'higher-is-better', value: 1 },
      { metricId: 'duplicate-occupancy', direction: 'lower-is-better', value: 0 },
    ]);
    expect(candidate.rankedSceneCount).toBe(12);
  });

  it('does not use expected benchmark labels as candidate-ranking input', () => {
    const altered = structuredClone(PHASE11_LIGHTWEIGHT_TEMPORAL_BASELINE_FIXTURE_V1);
    altered.cases[0]!.expectedOrderedSceneRevisionIds = ['scene:a1:r1', 'scene:a2:r1'];
    altered.cases[1]!.expectedOrderedSceneRevisionIds = ['scene:b1:r1', 'scene:b2:r1'];

    const original = evaluateTemporalAdjacencyCandidateV1(PHASE11_LIGHTWEIGHT_TEMPORAL_BASELINE_FIXTURE_V1);
    const changed = evaluateTemporalAdjacencyCandidateV1(altered);
    expect(changed.rankingsByCase).toEqual(original.rankingsByCase);
  });

  it('builds a valid same-fixture comparison with explicit baseline and candidate cost', () => {
    const run = runTemporalCandidateComparisonV1(
      PHASE11_LIGHTWEIGHT_TEMPORAL_BASELINE_FIXTURE_V1,
      { warmupIterations: 2, measuredIterationsPerSample: 10, sampleCount: 3 },
      '2026-08-28T00:00:00.000Z',
      deterministicClock(10_000_000n),
    );

    expect(validateTemporalIntelligenceBenchmarkComparisonV1(run.comparison)).toEqual({ valid: true, errors: [] });
    expect(run.comparison.lightweightBaseline.cost).toEqual({ wallClockMs: 1, computeUnits: 10 });
    expect(run.comparison.candidate.cost).toEqual({ wallClockMs: 1, computeUnits: 12 });
    expect(run.baselineComputeUnitDefinition).toBe('ranked-scene-evaluation:v1');
    expect(run.candidateComputeUnitDefinition).toBe('ranked-scene-evaluation:v1');
    expect(temporalCandidateWinsEveryQualityMetricV1(run.comparison)).toBe(true);
  });

  it('captures same-process real runtime evidence without inventing a cost threshold', () => {
    const run = runTemporalCandidateComparisonV1(
      PHASE11_LIGHTWEIGHT_TEMPORAL_BASELINE_FIXTURE_V1,
      { warmupIterations: 50, measuredIterationsPerSample: 1000, sampleCount: 5 },
      new Date().toISOString(),
    );

    expect(validateTemporalIntelligenceBenchmarkComparisonV1(run.comparison)).toEqual({ valid: true, errors: [] });
    expect(temporalCandidateWinsEveryQualityMetricV1(run.comparison)).toBe(true);
    expect(run.comparison.lightweightBaseline.cost.wallClockMs).toBeGreaterThan(0);
    expect(run.comparison.candidate.cost.wallClockMs).toBeGreaterThan(0);
    expect(run.comparison.lightweightBaseline.cost.computeUnits).toBe(10);
    expect(run.comparison.candidate.cost.computeUnits).toBe(12);

    console.log(`PHASE11_TEMPORAL_CANDIDATE_COMPARISON_V1=${JSON.stringify({
      ...run,
      runtime: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    })}`);
  });
});
