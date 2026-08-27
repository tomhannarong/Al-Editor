import { describe, expect, it } from 'vitest';
import { PHASE11_LIGHTWEIGHT_TEMPORAL_BASELINE_FIXTURE_V1 } from './phase11-lightweight-baseline.fixture.js';
import {
  measureTemporalLightweightBaselineRuntimeCostV1,
  temporalLightweightBaselineApproachMeasurementV1,
  validateTemporalLightweightRuntimeCostMeasurementV1,
  type TemporalLightweightRuntimeCostMeasurementV1,
} from './runtime-cost.js';

function deterministicClock(stepNs: bigint): () => bigint {
  let now = 0n;
  return () => {
    now += stepNs;
    return now;
  };
}

describe('Phase-11 lightweight temporal runtime cost', () => {
  it('measures a deterministic normalized workload with an injected monotonic clock', () => {
    const measurement = measureTemporalLightweightBaselineRuntimeCostV1(
      PHASE11_LIGHTWEIGHT_TEMPORAL_BASELINE_FIXTURE_V1,
      { warmupIterations: 2, measuredIterationsPerSample: 10, sampleCount: 3 },
      deterministicClock(10_000_000n),
    );

    expect(measurement.sampleWallClockMsPerEvaluation).toEqual([1, 1, 1]);
    expect(measurement.wallClockMsPerEvaluation).toBe(1);
    expect(measurement.totalMeasuredWallClockMs).toBe(30);
    expect(measurement.computeUnitsPerEvaluation).toBe(10);
    expect(measurement.totalMeasuredComputeUnits).toBe(300);
    expect(validateTemporalLightweightRuntimeCostMeasurementV1(
      measurement,
      PHASE11_LIGHTWEIGHT_TEMPORAL_BASELINE_FIXTURE_V1,
    )).toEqual({ valid: true, errors: [] });

    expect(temporalLightweightBaselineApproachMeasurementV1(measurement)).toMatchObject({
      approach: {
        approachId: 'lightweight-scene-retrieval-control',
        revisionId: 'lightweight-scene-retrieval-control:r1',
      },
      cost: { wallClockMs: 1, computeUnits: 10 },
    });
  });

  it('fails closed on tampered identity, quality, sample, and compute-unit evidence', () => {
    const measurement = structuredClone(measureTemporalLightweightBaselineRuntimeCostV1(
      PHASE11_LIGHTWEIGHT_TEMPORAL_BASELINE_FIXTURE_V1,
      { warmupIterations: 0, measuredIterationsPerSample: 5, sampleCount: 3 },
      deterministicClock(5_000_000n),
    )) as TemporalLightweightRuntimeCostMeasurementV1;

    measurement.benchmarkRevisionId = 'temporal-benchmark:phase11:r2';
    measurement.quality[0]!.value = 1;
    const mutableSamples = measurement.sampleWallClockMsPerEvaluation as number[];
    mutableSamples[0] = -1;
    measurement.computeUnitsPerEvaluation = 9;
    measurement.totalMeasuredComputeUnits = 1;

    const validation = validateTemporalLightweightRuntimeCostMeasurementV1(
      measurement,
      PHASE11_LIGHTWEIGHT_TEMPORAL_BASELINE_FIXTURE_V1,
    );
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('benchmarkRevisionId must match frozen fixture');
    expect(validation.errors).toContain('quality must exactly match frozen baseline evaluation');
    expect(validation.errors).toContain('sample wall-clock measurements must be finite and positive');
    expect(validation.errors).toContain('computeUnitsPerEvaluation must equal ranked scene evaluations in the frozen fixture');
    expect(validation.errors).toContain('totalMeasuredComputeUnits must match the normalized workload');
  });

  it('rejects unbounded/invalid measurement options before runtime work', () => {
    expect(() => measureTemporalLightweightBaselineRuntimeCostV1(
      PHASE11_LIGHTWEIGHT_TEMPORAL_BASELINE_FIXTURE_V1,
      { warmupIterations: -1, measuredIterationsPerSample: 0, sampleCount: 2 },
      deterministicClock(1n),
    )).toThrow('Invalid temporal runtime cost options');
  });

  it('captures bounded real wall-clock evidence without asserting a machine-specific threshold', () => {
    const measurement = measureTemporalLightweightBaselineRuntimeCostV1(
      PHASE11_LIGHTWEIGHT_TEMPORAL_BASELINE_FIXTURE_V1,
      { warmupIterations: 50, measuredIterationsPerSample: 1000, sampleCount: 5 },
    );
    expect(validateTemporalLightweightRuntimeCostMeasurementV1(
      measurement,
      PHASE11_LIGHTWEIGHT_TEMPORAL_BASELINE_FIXTURE_V1,
    )).toEqual({ valid: true, errors: [] });
    expect(measurement.wallClockMsPerEvaluation).toBeGreaterThan(0);
    expect(measurement.computeUnitsPerEvaluation).toBe(10);

    console.log(`PHASE11_LIGHTWEIGHT_RUNTIME_COST_V1=${JSON.stringify({
      ...measurement,
      runtime: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    })}`);
  });
});
