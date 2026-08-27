export const REGRESSION_GATE_SCHEMA_VERSION = '1.0' as const;

export type RegressionMetricDirectionV1 = 'higher-is-better' | 'lower-is-better';

export interface RegressionGateBenchmarkControlRefV1 {
  benchmarkId: string;
  benchmarkRevisionId: string;
  controlRevisionId: string;
  fixtureRevisionId?: string;
}

export interface RegressionGateCandidateResultRefV1 {
  experimentId: string;
  experimentRevisionId: string;
  resultId: string;
  resultRevisionId: string;
  resultSha256: string;
}

export interface RegressionMetricRuleV1 {
  metricId: string;
  direction: RegressionMetricDirectionV1;
  tolerance: {
    kind: 'absolute';
    maxRegression: number;
  };
}

export interface RegressionGateRevisionV1 {
  schemaVersion: typeof REGRESSION_GATE_SCHEMA_VERSION;
  gateId: string;
  revisionId: string;
  benchmarkControl: RegressionGateBenchmarkControlRefV1;
  candidate: RegressionGateCandidateResultRefV1;
  metrics: RegressionMetricRuleV1[];
  createdAt: string;
}

export interface RegressionGateValidationResult {
  valid: boolean;
  errors: string[];
}

const SHA256 = /^[a-f0-9]{64}$/i;
const MUTABLE_ALIASES = new Set(['latest', 'main', 'master', 'stable', 'default', 'current', 'head']);
const nonEmpty = (value: string): boolean => value.trim().length > 0;
const validTimestamp = (value: string): boolean => Number.isFinite(Date.parse(value));
const pinned = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && !MUTABLE_ALIASES.has(normalized);
};

function requirePinned(errors: string[], value: string, field: string): void {
  if (!pinned(value)) errors.push(`${field} must be pinned and must not use a mutable alias`);
}

export function validateRegressionGateRevisionV1(
  revision: RegressionGateRevisionV1,
): RegressionGateValidationResult {
  const errors: string[] = [];

  if (revision.schemaVersion !== REGRESSION_GATE_SCHEMA_VERSION) {
    errors.push('schemaVersion must be 1.0');
  }
  if (!nonEmpty(revision.gateId)) errors.push('gateId is required');
  requirePinned(errors, revision.revisionId, 'revisionId');

  if (!nonEmpty(revision.benchmarkControl.benchmarkId)) errors.push('benchmarkControl.benchmarkId is required');
  requirePinned(errors, revision.benchmarkControl.benchmarkRevisionId, 'benchmarkControl.benchmarkRevisionId');
  requirePinned(errors, revision.benchmarkControl.controlRevisionId, 'benchmarkControl.controlRevisionId');
  if (revision.benchmarkControl.fixtureRevisionId !== undefined) {
    requirePinned(errors, revision.benchmarkControl.fixtureRevisionId, 'benchmarkControl.fixtureRevisionId');
  }

  if (!nonEmpty(revision.candidate.experimentId)) errors.push('candidate.experimentId is required');
  requirePinned(errors, revision.candidate.experimentRevisionId, 'candidate.experimentRevisionId');
  if (!nonEmpty(revision.candidate.resultId)) errors.push('candidate.resultId is required');
  requirePinned(errors, revision.candidate.resultRevisionId, 'candidate.resultRevisionId');
  if (!SHA256.test(revision.candidate.resultSha256)) {
    errors.push('candidate.resultSha256 must be a SHA-256 hex digest');
  }

  if (revision.metrics.length === 0) errors.push('metrics must contain at least one rule');
  const metricIds = new Set<string>();
  revision.metrics.forEach((metric, index) => {
    const prefix = `metrics[${index}]`;
    if (!nonEmpty(metric.metricId)) {
      errors.push(`${prefix}.metricId is required`);
    } else if (metricIds.has(metric.metricId)) {
      errors.push(`${prefix}.metricId must be unique`);
    } else {
      metricIds.add(metric.metricId);
    }
    if (metric.direction !== 'higher-is-better' && metric.direction !== 'lower-is-better') {
      errors.push(`${prefix}.direction must be higher-is-better or lower-is-better`);
    }
    if (metric.tolerance.kind !== 'absolute') {
      errors.push(`${prefix}.tolerance.kind must be absolute`);
    }
    if (!Number.isFinite(metric.tolerance.maxRegression) || metric.tolerance.maxRegression < 0) {
      errors.push(`${prefix}.tolerance.maxRegression must be a finite non-negative number`);
    }
  });

  if (!validTimestamp(revision.createdAt)) errors.push('createdAt must be a valid timestamp');

  return { valid: errors.length === 0, errors };
}

export function passesRegressionMetricRuleV1(
  rule: RegressionMetricRuleV1,
  controlValue: number,
  candidateValue: number,
): boolean {
  if (!Number.isFinite(controlValue) || !Number.isFinite(candidateValue)) return false;
  if (!Number.isFinite(rule.tolerance.maxRegression) || rule.tolerance.maxRegression < 0) return false;

  if (rule.direction === 'higher-is-better') {
    return candidateValue >= controlValue - rule.tolerance.maxRegression;
  }
  if (rule.direction === 'lower-is-better') {
    return candidateValue <= controlValue + rule.tolerance.maxRegression;
  }
  return false;
}
