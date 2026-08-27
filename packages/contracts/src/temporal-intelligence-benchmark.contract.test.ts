import { describe, expect, it } from 'vitest';
import {
  TEMPORAL_INTELLIGENCE_BENCHMARK_SCHEMA_VERSION,
  temporalQualityImprovedV1,
  validateTemporalIntelligenceBenchmarkComparisonV1,
  type TemporalIntelligenceBenchmarkComparisonV1,
} from './temporal-intelligence-benchmark.contract.js';

function comparison(): TemporalIntelligenceBenchmarkComparisonV1 {
  return {
    schemaVersion: TEMPORAL_INTELLIGENCE_BENCHMARK_SCHEMA_VERSION,
    comparisonId: 'temporal-comparison:phase11:v1',
    revisionId: 'temporal-comparison:phase11:r1',
    fixture: {
      benchmarkId: 'temporal-benchmark:phase11',
      benchmarkRevisionId: 'temporal-benchmark:phase11:r1',
      fixtureRevisionId: 'temporal-fixture:travel-motion:r1',
    },
    lightweightBaseline: {
      approach: { approachId: 'lightweight-scene-baseline', revisionId: 'lightweight-scene-baseline:r1' },
      quality: [
        { metricId: 'temporal-recall-at-10', direction: 'higher-is-better', value: 0.7 },
        { metricId: 'duplicate-occupancy', direction: 'lower-is-better', value: 0.2 },
      ],
      cost: { wallClockMs: 120, computeUnits: 1, peakMemoryMb: 256 },
    },
    candidate: {
      approach: {
        approachId: 'advanced-temporal-model',
        revisionId: 'advanced-temporal-model:r1',
        modelRevisionId: 'temporal-model:weights:r1',
      },
      quality: [
        { metricId: 'temporal-recall-at-10', direction: 'higher-is-better', value: 0.82 },
        { metricId: 'duplicate-occupancy', direction: 'lower-is-better', value: 0.12 },
      ],
      cost: { wallClockMs: 900, computeUnits: 7.5, peakMemoryMb: 2048 },
    },
    measuredAt: '2026-08-28T01:10:00+07:00',
  };
}

describe('temporal intelligence benchmark comparison contract', () => {
  it('accepts pinned same-fixture quality and measured-cost evidence', () => {
    expect(validateTemporalIntelligenceBenchmarkComparisonV1(comparison())).toEqual({ valid: true, errors: [] });
  });

  it('rejects mutable benchmark/model revisions and malformed cost evidence', () => {
    const candidate = comparison();
    candidate.fixture.benchmarkRevisionId = 'latest';
    candidate.candidate.approach.modelRevisionId = 'main';
    candidate.candidate.cost.computeUnits = Number.NaN;
    const result = validateTemporalIntelligenceBenchmarkComparisonV1(candidate);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('fixture.benchmarkRevisionId must be pinned and must not use a mutable alias');
    expect(result.errors).toContain('candidate.approach.modelRevisionId must be pinned and must not use a mutable alias');
    expect(result.errors).toContain('candidate.cost.computeUnits must be a finite non-negative number');
  });

  it('requires exact metric identity and direction across baseline and candidate', () => {
    const candidate = comparison();
    candidate.candidate.quality = [
      { metricId: 'temporal-recall-at-10', direction: 'lower-is-better', value: 0.82 },
      { metricId: 'new-uncontrolled-metric', direction: 'higher-is-better', value: 1 },
    ];
    const result = validateTemporalIntelligenceBenchmarkComparisonV1(candidate);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('candidate quality metric temporal-recall-at-10 direction must match lightweight baseline');
    expect(result.errors).toContain('candidate quality metric duplicate-occupancy is missing');
    expect(result.errors).toContain('candidate quality metric new-uncontrolled-metric is not present in lightweight baseline');
  });

  it('rejects comparing an approach revision against itself', () => {
    const candidate = comparison();
    candidate.candidate.approach = { ...candidate.lightweightBaseline.approach };
    const result = validateTemporalIntelligenceBenchmarkComparisonV1(candidate);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('candidate must not be the exact same approach revision as lightweight baseline');
  });

  it('evaluates strict quality improvement without inventing a cost threshold', () => {
    expect(temporalQualityImprovedV1(
      { metricId: 'recall', direction: 'higher-is-better', value: 0.7 },
      { metricId: 'recall', direction: 'higher-is-better', value: 0.8 },
    )).toBe(true);
    expect(temporalQualityImprovedV1(
      { metricId: 'duplicate', direction: 'lower-is-better', value: 0.2 },
      { metricId: 'duplicate', direction: 'lower-is-better', value: 0.1 },
    )).toBe(true);
    expect(temporalQualityImprovedV1(
      { metricId: 'recall', direction: 'higher-is-better', value: 0.7 },
      { metricId: 'recall', direction: 'higher-is-better', value: 0.7 },
    )).toBe(false);
  });
});
