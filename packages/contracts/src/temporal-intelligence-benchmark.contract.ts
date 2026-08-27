export const TEMPORAL_INTELLIGENCE_BENCHMARK_SCHEMA_VERSION = '1.0' as const;

export type TemporalQualityMetricDirectionV1 = 'higher-is-better' | 'lower-is-better';

export interface TemporalBenchmarkFixtureRefV1 {
  benchmarkId: string;
  benchmarkRevisionId: string;
  fixtureRevisionId: string;
}

export interface TemporalApproachRefV1 {
  approachId: string;
  revisionId: string;
  modelRevisionId?: string;
  policyRevisionId?: string;
}

export interface TemporalQualityMetricV1 {
  metricId: string;
  direction: TemporalQualityMetricDirectionV1;
  value: number;
}

export interface TemporalCostMeasurementV1 {
  wallClockMs: number;
  computeUnits: number;
  peakMemoryMb?: number;
}

export interface TemporalApproachMeasurementV1 {
  approach: TemporalApproachRefV1;
  quality: readonly TemporalQualityMetricV1[];
  cost: TemporalCostMeasurementV1;
}

export interface TemporalIntelligenceBenchmarkComparisonV1 {
  schemaVersion: typeof TEMPORAL_INTELLIGENCE_BENCHMARK_SCHEMA_VERSION;
  comparisonId: string;
  revisionId: string;
  fixture: TemporalBenchmarkFixtureRefV1;
  lightweightBaseline: TemporalApproachMeasurementV1;
  candidate: TemporalApproachMeasurementV1;
  measuredAt: string;
}

export interface TemporalIntelligenceBenchmarkValidationResult {
  valid: boolean;
  errors: string[];
}

const MUTABLE_ALIASES = new Set(['latest', 'main', 'master', 'stable', 'default', 'current', 'head']);
const nonEmpty = (value: string): boolean => value.trim().length > 0;
const pinned = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && !MUTABLE_ALIASES.has(normalized);
};

function requirePinned(errors: string[], value: string, field: string): void {
  if (!pinned(value)) errors.push(`${field} must be pinned and must not use a mutable alias`);
}

function validateApproach(
  errors: string[],
  measurement: TemporalApproachMeasurementV1,
  field: 'lightweightBaseline' | 'candidate',
): void {
  if (!nonEmpty(measurement.approach.approachId)) errors.push(`${field}.approach.approachId is required`);
  requirePinned(errors, measurement.approach.revisionId, `${field}.approach.revisionId`);
  if (measurement.approach.modelRevisionId !== undefined) {
    requirePinned(errors, measurement.approach.modelRevisionId, `${field}.approach.modelRevisionId`);
  }
  if (measurement.approach.policyRevisionId !== undefined) {
    requirePinned(errors, measurement.approach.policyRevisionId, `${field}.approach.policyRevisionId`);
  }

  if (measurement.quality.length === 0) errors.push(`${field}.quality must contain at least one metric`);
  const metricIds = new Set<string>();
  measurement.quality.forEach((metric, index) => {
    const prefix = `${field}.quality[${index}]`;
    if (!nonEmpty(metric.metricId)) errors.push(`${prefix}.metricId is required`);
    else if (metricIds.has(metric.metricId)) errors.push(`${prefix}.metricId must be unique`);
    else metricIds.add(metric.metricId);
    if (metric.direction !== 'higher-is-better' && metric.direction !== 'lower-is-better') {
      errors.push(`${prefix}.direction must be higher-is-better or lower-is-better`);
    }
    if (!Number.isFinite(metric.value)) errors.push(`${prefix}.value must be finite`);
  });

  if (!Number.isFinite(measurement.cost.wallClockMs) || measurement.cost.wallClockMs < 0) {
    errors.push(`${field}.cost.wallClockMs must be a finite non-negative number`);
  }
  if (!Number.isFinite(measurement.cost.computeUnits) || measurement.cost.computeUnits < 0) {
    errors.push(`${field}.cost.computeUnits must be a finite non-negative number`);
  }
  if (
    measurement.cost.peakMemoryMb !== undefined &&
    (!Number.isFinite(measurement.cost.peakMemoryMb) || measurement.cost.peakMemoryMb < 0)
  ) {
    errors.push(`${field}.cost.peakMemoryMb must be a finite non-negative number`);
  }
}

export function validateTemporalIntelligenceBenchmarkComparisonV1(
  comparison: TemporalIntelligenceBenchmarkComparisonV1,
): TemporalIntelligenceBenchmarkValidationResult {
  const errors: string[] = [];

  if (comparison.schemaVersion !== TEMPORAL_INTELLIGENCE_BENCHMARK_SCHEMA_VERSION) {
    errors.push('schemaVersion must be 1.0');
  }
  if (!nonEmpty(comparison.comparisonId)) errors.push('comparisonId is required');
  requirePinned(errors, comparison.revisionId, 'revisionId');

  if (!nonEmpty(comparison.fixture.benchmarkId)) errors.push('fixture.benchmarkId is required');
  requirePinned(errors, comparison.fixture.benchmarkRevisionId, 'fixture.benchmarkRevisionId');
  requirePinned(errors, comparison.fixture.fixtureRevisionId, 'fixture.fixtureRevisionId');

  validateApproach(errors, comparison.lightweightBaseline, 'lightweightBaseline');
  validateApproach(errors, comparison.candidate, 'candidate');

  const baselineMetrics = new Map(comparison.lightweightBaseline.quality.map((metric) => [metric.metricId, metric]));
  const candidateMetrics = new Map(comparison.candidate.quality.map((metric) => [metric.metricId, metric]));
  if (baselineMetrics.size !== candidateMetrics.size) {
    errors.push('candidate quality metrics must exactly match lightweight baseline metric IDs');
  }
  for (const [metricId, baselineMetric] of baselineMetrics) {
    const candidateMetric = candidateMetrics.get(metricId);
    if (!candidateMetric) {
      errors.push(`candidate quality metric ${metricId} is missing`);
      continue;
    }
    if (candidateMetric.direction !== baselineMetric.direction) {
      errors.push(`candidate quality metric ${metricId} direction must match lightweight baseline`);
    }
  }
  for (const metricId of candidateMetrics.keys()) {
    if (!baselineMetrics.has(metricId)) errors.push(`candidate quality metric ${metricId} is not present in lightweight baseline`);
  }

  if (
    comparison.lightweightBaseline.approach.approachId === comparison.candidate.approach.approachId &&
    comparison.lightweightBaseline.approach.revisionId === comparison.candidate.approach.revisionId
  ) {
    errors.push('candidate must not be the exact same approach revision as lightweight baseline');
  }

  if (!Number.isFinite(Date.parse(comparison.measuredAt))) errors.push('measuredAt must be a valid timestamp');
  return { valid: errors.length === 0, errors };
}

export function temporalQualityImprovedV1(
  baseline: TemporalQualityMetricV1,
  candidate: TemporalQualityMetricV1,
): boolean {
  if (baseline.metricId !== candidate.metricId || baseline.direction !== candidate.direction) return false;
  if (!Number.isFinite(baseline.value) || !Number.isFinite(candidate.value)) return false;
  return baseline.direction === 'higher-is-better'
    ? candidate.value > baseline.value
    : candidate.value < baseline.value;
}
