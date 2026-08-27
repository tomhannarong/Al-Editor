import {
  type TemporalApproachMeasurementV1,
  type TemporalQualityMetricV1,
} from '../../contracts/src/temporal-intelligence-benchmark.contract.js';
import {
  evaluateTemporalLightweightBaselineV1,
  validateTemporalLightweightBaselineFixtureV1,
  type TemporalLightweightBaselineFixtureV1,
} from './lightweight-baseline.js';

export const TEMPORAL_LIGHTWEIGHT_RUNTIME_COST_SCHEMA_VERSION = '1.0' as const;
export const TEMPORAL_LIGHTWEIGHT_RUNTIME_COST_PROTOCOL_VERSION = 'temporal-lightweight-runtime-cost:v1' as const;
export const TEMPORAL_LIGHTWEIGHT_COMPUTE_UNIT_DEFINITION = 'ranked-scene-evaluation:v1' as const;

export interface TemporalLightweightRuntimeCostOptionsV1 {
  warmupIterations: number;
  measuredIterationsPerSample: number;
  sampleCount: number;
}

export interface TemporalLightweightRuntimeCostMeasurementV1 {
  schemaVersion: typeof TEMPORAL_LIGHTWEIGHT_RUNTIME_COST_SCHEMA_VERSION;
  protocolVersion: typeof TEMPORAL_LIGHTWEIGHT_RUNTIME_COST_PROTOCOL_VERSION;
  benchmarkId: string;
  benchmarkRevisionId: string;
  fixtureRevisionId: string;
  approachId: string;
  approachRevisionId: string;
  quality: readonly TemporalQualityMetricV1[];
  warmupIterations: number;
  measuredIterationsPerSample: number;
  sampleCount: number;
  sampleWallClockMsPerEvaluation: readonly number[];
  wallClockMsPerEvaluation: number;
  totalMeasuredWallClockMs: number;
  computeUnitDefinition: typeof TEMPORAL_LIGHTWEIGHT_COMPUTE_UNIT_DEFINITION;
  computeUnitsPerEvaluation: number;
  totalMeasuredComputeUnits: number;
}

export interface TemporalLightweightRuntimeCostValidationResult {
  valid: boolean;
  errors: string[];
}

export type TemporalMonotonicClockV1 = () => bigint;

const MAX_WARMUP_ITERATIONS = 100_000;
const MAX_MEASURED_ITERATIONS_PER_SAMPLE = 100_000;
const MAX_SAMPLE_COUNT = 101;

function boundedInteger(value: number, minimum: number, maximum: number): boolean {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

function validateOptions(options: TemporalLightweightRuntimeCostOptionsV1): string[] {
  const errors: string[] = [];
  if (!boundedInteger(options.warmupIterations, 0, MAX_WARMUP_ITERATIONS)) {
    errors.push(`warmupIterations must be a safe integer between 0 and ${MAX_WARMUP_ITERATIONS}`);
  }
  if (!boundedInteger(options.measuredIterationsPerSample, 1, MAX_MEASURED_ITERATIONS_PER_SAMPLE)) {
    errors.push(`measuredIterationsPerSample must be a safe integer between 1 and ${MAX_MEASURED_ITERATIONS_PER_SAMPLE}`);
  }
  if (!boundedInteger(options.sampleCount, 1, MAX_SAMPLE_COUNT) || options.sampleCount % 2 === 0) {
    errors.push(`sampleCount must be an odd safe integer between 1 and ${MAX_SAMPLE_COUNT}`);
  }
  return errors;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function approximatelyEqual(left: number, right: number): boolean {
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= Number.EPSILON * scale * 8;
}

function qualityEquals(left: readonly TemporalQualityMetricV1[], right: readonly TemporalQualityMetricV1[]): boolean {
  return left.length === right.length && left.every((metric, index) => {
    const other = right[index];
    return other !== undefined
      && metric.metricId === other.metricId
      && metric.direction === other.direction
      && metric.value === other.value;
  });
}

export function measureTemporalLightweightBaselineRuntimeCostV1(
  fixture: TemporalLightweightBaselineFixtureV1,
  options: TemporalLightweightRuntimeCostOptionsV1,
  nowNs: TemporalMonotonicClockV1 = process.hrtime.bigint,
): TemporalLightweightRuntimeCostMeasurementV1 {
  const fixtureValidation = validateTemporalLightweightBaselineFixtureV1(fixture);
  if (!fixtureValidation.valid) {
    throw new Error(`Invalid temporal lightweight baseline fixture: ${fixtureValidation.errors.join('; ')}`);
  }
  const optionErrors = validateOptions(options);
  if (optionErrors.length > 0) throw new Error(`Invalid temporal runtime cost options: ${optionErrors.join('; ')}`);

  const reference = evaluateTemporalLightweightBaselineV1(fixture);
  for (let iteration = 0; iteration < options.warmupIterations; iteration += 1) {
    evaluateTemporalLightweightBaselineV1(fixture);
  }

  const samples: number[] = [];
  let totalMeasuredWallClockMs = 0;
  for (let sampleIndex = 0; sampleIndex < options.sampleCount; sampleIndex += 1) {
    const startedNs = nowNs();
    for (let iteration = 0; iteration < options.measuredIterationsPerSample; iteration += 1) {
      const current = evaluateTemporalLightweightBaselineV1(fixture);
      if (!qualityEquals(current.quality, reference.quality)) {
        throw new Error('Temporal lightweight baseline quality changed during runtime measurement');
      }
    }
    const completedNs = nowNs();
    if (completedNs <= startedNs) throw new Error('Monotonic runtime clock must advance for every measurement sample');
    const sampleTotalMs = Number(completedNs - startedNs) / 1_000_000;
    if (!Number.isFinite(sampleTotalMs) || sampleTotalMs <= 0) throw new Error('Measured wall-clock duration must be finite and positive');
    totalMeasuredWallClockMs += sampleTotalMs;
    samples.push(sampleTotalMs / options.measuredIterationsPerSample);
  }

  const computeUnitsPerEvaluation = reference.rankedSceneCount;
  const totalMeasuredComputeUnits = computeUnitsPerEvaluation
    * options.measuredIterationsPerSample
    * options.sampleCount;

  return Object.freeze({
    schemaVersion: TEMPORAL_LIGHTWEIGHT_RUNTIME_COST_SCHEMA_VERSION,
    protocolVersion: TEMPORAL_LIGHTWEIGHT_RUNTIME_COST_PROTOCOL_VERSION,
    benchmarkId: fixture.benchmarkId,
    benchmarkRevisionId: fixture.benchmarkRevisionId,
    fixtureRevisionId: fixture.fixtureRevisionId,
    approachId: fixture.approachId,
    approachRevisionId: fixture.approachRevisionId,
    quality: Object.freeze(reference.quality.map((metric) => Object.freeze({ ...metric }))),
    warmupIterations: options.warmupIterations,
    measuredIterationsPerSample: options.measuredIterationsPerSample,
    sampleCount: options.sampleCount,
    sampleWallClockMsPerEvaluation: Object.freeze(samples),
    wallClockMsPerEvaluation: median(samples),
    totalMeasuredWallClockMs,
    computeUnitDefinition: TEMPORAL_LIGHTWEIGHT_COMPUTE_UNIT_DEFINITION,
    computeUnitsPerEvaluation,
    totalMeasuredComputeUnits,
  });
}

export function validateTemporalLightweightRuntimeCostMeasurementV1(
  measurement: TemporalLightweightRuntimeCostMeasurementV1,
  fixture: TemporalLightweightBaselineFixtureV1,
): TemporalLightweightRuntimeCostValidationResult {
  const errors: string[] = [];
  if (measurement.schemaVersion !== TEMPORAL_LIGHTWEIGHT_RUNTIME_COST_SCHEMA_VERSION) errors.push('schemaVersion must be 1.0');
  if (measurement.protocolVersion !== TEMPORAL_LIGHTWEIGHT_RUNTIME_COST_PROTOCOL_VERSION) errors.push('protocolVersion must be temporal-lightweight-runtime-cost:v1');
  if (measurement.computeUnitDefinition !== TEMPORAL_LIGHTWEIGHT_COMPUTE_UNIT_DEFINITION) errors.push('computeUnitDefinition must be ranked-scene-evaluation:v1');

  const optionErrors = validateOptions(measurement);
  errors.push(...optionErrors);

  const fixtureValidation = validateTemporalLightweightBaselineFixtureV1(fixture);
  if (!fixtureValidation.valid) {
    errors.push(...fixtureValidation.errors.map((error) => `fixture: ${error}`));
    return { valid: false, errors };
  }
  const reference = evaluateTemporalLightweightBaselineV1(fixture);
  if (measurement.benchmarkId !== reference.benchmarkId) errors.push('benchmarkId must match frozen fixture');
  if (measurement.benchmarkRevisionId !== reference.benchmarkRevisionId) errors.push('benchmarkRevisionId must match frozen fixture');
  if (measurement.fixtureRevisionId !== reference.fixtureRevisionId) errors.push('fixtureRevisionId must match frozen fixture');
  if (measurement.approachId !== reference.approachId) errors.push('approachId must match frozen fixture');
  if (measurement.approachRevisionId !== reference.approachRevisionId) errors.push('approachRevisionId must match frozen fixture');
  if (!qualityEquals(measurement.quality, reference.quality)) errors.push('quality must exactly match frozen baseline evaluation');

  if (measurement.sampleWallClockMsPerEvaluation.length !== measurement.sampleCount) {
    errors.push('sampleWallClockMsPerEvaluation length must equal sampleCount');
  }
  if (measurement.sampleWallClockMsPerEvaluation.some((value) => !Number.isFinite(value) || value <= 0)) {
    errors.push('sample wall-clock measurements must be finite and positive');
  }
  if (!Number.isFinite(measurement.wallClockMsPerEvaluation) || measurement.wallClockMsPerEvaluation <= 0) {
    errors.push('wallClockMsPerEvaluation must be finite and positive');
  } else if (
    measurement.sampleWallClockMsPerEvaluation.length > 0
    && !approximatelyEqual(measurement.wallClockMsPerEvaluation, median(measurement.sampleWallClockMsPerEvaluation))
  ) {
    errors.push('wallClockMsPerEvaluation must equal the median sample value');
  }
  if (!Number.isFinite(measurement.totalMeasuredWallClockMs) || measurement.totalMeasuredWallClockMs <= 0) {
    errors.push('totalMeasuredWallClockMs must be finite and positive');
  } else {
    const reconstructedTotal = measurement.sampleWallClockMsPerEvaluation.reduce(
      (sum, value) => sum + value * measurement.measuredIterationsPerSample,
      0,
    );
    if (!approximatelyEqual(measurement.totalMeasuredWallClockMs, reconstructedTotal)) {
      errors.push('totalMeasuredWallClockMs must match the recorded samples');
    }
  }

  if (measurement.computeUnitsPerEvaluation !== reference.rankedSceneCount) {
    errors.push('computeUnitsPerEvaluation must equal ranked scene evaluations in the frozen fixture');
  }
  const expectedTotalComputeUnits = reference.rankedSceneCount
    * measurement.measuredIterationsPerSample
    * measurement.sampleCount;
  if (measurement.totalMeasuredComputeUnits !== expectedTotalComputeUnits) {
    errors.push('totalMeasuredComputeUnits must match the normalized workload');
  }

  return { valid: errors.length === 0, errors };
}

export function temporalLightweightBaselineApproachMeasurementV1(
  measurement: TemporalLightweightRuntimeCostMeasurementV1,
): TemporalApproachMeasurementV1 {
  return {
    approach: {
      approachId: measurement.approachId,
      revisionId: measurement.approachRevisionId,
    },
    quality: measurement.quality.map((metric) => ({ ...metric })),
    cost: {
      wallClockMs: measurement.wallClockMsPerEvaluation,
      computeUnits: measurement.computeUnitsPerEvaluation,
    },
  };
}
