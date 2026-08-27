import {
  passesRegressionMetricRuleV1,
  validateRegressionGateRevisionV1,
  type RegressionGateBenchmarkControlRefV1,
  type RegressionGateCandidateResultRefV1,
  type RegressionGateRevisionV1,
  type RegressionMetricDirectionV1,
} from '../../contracts/src/regression-gate.contract.js';

export const REGRESSION_GATE_EXECUTION_SCHEMA_VERSION = '1.0' as const;

export interface RegressionMetricMeasurementV1 {
  metricId: string;
  value: number;
}

export interface RegressionControlMetricEvidenceV1 {
  benchmarkControl: RegressionGateBenchmarkControlRefV1;
  metrics: RegressionMetricMeasurementV1[];
}

export interface RegressionCandidateMetricEvidenceV1 {
  benchmarkControl: RegressionGateBenchmarkControlRefV1;
  candidate: RegressionGateCandidateResultRefV1;
  metrics: RegressionMetricMeasurementV1[];
}

export interface RegressionMetricDecisionV1 {
  metricId: string;
  direction: RegressionMetricDirectionV1;
  controlValue: number;
  candidateValue: number;
  maxRegression: number;
  boundaryValue: number;
  passed: boolean;
}

export interface RegressionGateExecutionDecisionV1 {
  schemaVersion: typeof REGRESSION_GATE_EXECUTION_SCHEMA_VERSION;
  gateId: string;
  gateRevisionId: string;
  benchmarkId: string;
  benchmarkRevisionId: string;
  controlRevisionId: string;
  candidateExperimentRevisionId: string;
  candidateResultRevisionId: string;
  candidateResultSha256: string;
  passed: boolean;
  failedMetricIds: string[];
  metricDecisions: RegressionMetricDecisionV1[];
}

export class RegressionGateExecutionInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegressionGateExecutionInvariantError';
  }
}

/**
 * Deterministic Phase-9 regression-gate evaluator.
 *
 * This boundary consumes immutable benchmark/control and experiment/result
 * references. It does not persist benchmark payloads, experiment evidence or
 * model configuration, and it does not introduce any media/timeline authority.
 */
export function executeRegressionGateV1(
  gate: RegressionGateRevisionV1,
  controlEvidence: RegressionControlMetricEvidenceV1,
  candidateEvidence: RegressionCandidateMetricEvidenceV1,
): RegressionGateExecutionDecisionV1 {
  const validation = validateRegressionGateRevisionV1(gate);
  if (!validation.valid) {
    throw new RegressionGateExecutionInvariantError(
      `invalid regression gate revision: ${validation.errors.join('; ')}`,
    );
  }

  requireSameBenchmarkControl(gate.benchmarkControl, controlEvidence.benchmarkControl, 'controlEvidence');
  requireSameBenchmarkControl(gate.benchmarkControl, candidateEvidence.benchmarkControl, 'candidateEvidence');
  requireSameCandidate(gate.candidate, candidateEvidence.candidate);

  const expectedMetricIds = new Set(gate.metrics.map((metric) => metric.metricId));
  const controlMetrics = indexMetrics(controlEvidence.metrics, expectedMetricIds, 'controlEvidence.metrics');
  const candidateMetrics = indexMetrics(candidateEvidence.metrics, expectedMetricIds, 'candidateEvidence.metrics');

  for (const metricId of expectedMetricIds) {
    if (!controlMetrics.has(metricId)) {
      throw new RegressionGateExecutionInvariantError(`controlEvidence.metrics is missing ${metricId}`);
    }
    if (!candidateMetrics.has(metricId)) {
      throw new RegressionGateExecutionInvariantError(`candidateEvidence.metrics is missing ${metricId}`);
    }
  }

  const metricDecisions = gate.metrics.map((rule): RegressionMetricDecisionV1 => {
    const controlValue = requiredMetric(controlMetrics, rule.metricId, 'controlEvidence.metrics');
    const candidateValue = requiredMetric(candidateMetrics, rule.metricId, 'candidateEvidence.metrics');
    const maxRegression = rule.tolerance.maxRegression;
    const boundaryValue = rule.direction === 'higher-is-better'
      ? controlValue - maxRegression
      : controlValue + maxRegression;

    return {
      metricId: rule.metricId,
      direction: rule.direction,
      controlValue,
      candidateValue,
      maxRegression,
      boundaryValue,
      passed: passesRegressionMetricRuleV1(rule, controlValue, candidateValue),
    };
  });

  const failedMetricIds = metricDecisions
    .filter((decision) => !decision.passed)
    .map((decision) => decision.metricId);

  return {
    schemaVersion: REGRESSION_GATE_EXECUTION_SCHEMA_VERSION,
    gateId: gate.gateId,
    gateRevisionId: gate.revisionId,
    benchmarkId: gate.benchmarkControl.benchmarkId,
    benchmarkRevisionId: gate.benchmarkControl.benchmarkRevisionId,
    controlRevisionId: gate.benchmarkControl.controlRevisionId,
    candidateExperimentRevisionId: gate.candidate.experimentRevisionId,
    candidateResultRevisionId: gate.candidate.resultRevisionId,
    candidateResultSha256: gate.candidate.resultSha256.toLowerCase(),
    passed: failedMetricIds.length === 0,
    failedMetricIds,
    metricDecisions,
  };
}

function indexMetrics(
  metrics: readonly RegressionMetricMeasurementV1[],
  expectedMetricIds: ReadonlySet<string>,
  label: string,
): Map<string, number> {
  const indexed = new Map<string, number>();
  for (const measurement of metrics) {
    if (!measurement.metricId.trim()) {
      throw new RegressionGateExecutionInvariantError(`${label} contains an empty metricId`);
    }
    if (!expectedMetricIds.has(measurement.metricId)) {
      throw new RegressionGateExecutionInvariantError(`${label} contains unexpected metric ${measurement.metricId}`);
    }
    if (indexed.has(measurement.metricId)) {
      throw new RegressionGateExecutionInvariantError(`${label} contains duplicate metric ${measurement.metricId}`);
    }
    if (!Number.isFinite(measurement.value)) {
      throw new RegressionGateExecutionInvariantError(`${label}.${measurement.metricId} must be finite`);
    }
    indexed.set(measurement.metricId, measurement.value);
  }
  return indexed;
}

function requiredMetric(metrics: ReadonlyMap<string, number>, metricId: string, label: string): number {
  const value = metrics.get(metricId);
  if (value === undefined) {
    throw new RegressionGateExecutionInvariantError(`${label} is missing ${metricId}`);
  }
  return value;
}

function requireSameBenchmarkControl(
  expected: RegressionGateBenchmarkControlRefV1,
  actual: RegressionGateBenchmarkControlRefV1,
  label: string,
): void {
  if (
    expected.benchmarkId !== actual.benchmarkId
    || expected.benchmarkRevisionId !== actual.benchmarkRevisionId
    || expected.controlRevisionId !== actual.controlRevisionId
    || expected.fixtureRevisionId !== actual.fixtureRevisionId
  ) {
    throw new RegressionGateExecutionInvariantError(`${label}.benchmarkControl does not match gate evidence`);
  }
}

function requireSameCandidate(
  expected: RegressionGateCandidateResultRefV1,
  actual: RegressionGateCandidateResultRefV1,
): void {
  if (
    expected.experimentId !== actual.experimentId
    || expected.experimentRevisionId !== actual.experimentRevisionId
    || expected.resultId !== actual.resultId
    || expected.resultRevisionId !== actual.resultRevisionId
    || expected.resultSha256.toLowerCase() !== actual.resultSha256.toLowerCase()
  ) {
    throw new RegressionGateExecutionInvariantError('candidateEvidence.candidate does not match gate evidence');
  }
}
