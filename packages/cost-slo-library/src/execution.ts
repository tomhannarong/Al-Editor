import {
  validateAiStageTelemetryV1,
  type AiStageTelemetryV1,
} from '../../contracts/src/cost-performance-telemetry.contract.js';
import {
  validateCostSloPolicyRevisionV1,
  type CostSloPolicyRevisionV1,
} from '../../contracts/src/cost-slo-policy.contract.js';

export type CostSloEvaluationStatusV1 = 'pass' | 'breach' | 'insufficient-evidence';

export interface CostSloEvaluationRequestV1 {
  policy: CostSloPolicyRevisionV1;
  projectId: string;
  evaluatedAt: string;
  telemetry: readonly AiStageTelemetryV1[];
}

export interface CostSloMetricEvidenceV1 {
  metricId: 'total-cost-micros' | 'p95-wall-duration-ms' | 'failure-rate-basis-points';
  value: number;
  limit: number;
  breached: boolean;
}

export interface CostSloEvaluationV1 {
  policyId: string;
  policyRevisionId: string;
  projectId: string;
  evaluatedAt: string;
  windowStartedAt: string;
  observedStageRuns: number;
  scopedTelemetryRuns: number;
  status: CostSloEvaluationStatusV1;
  metrics: readonly CostSloMetricEvidenceV1[];
  reasons: readonly string[];
}

function percentile95(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index]!;
}

export function evaluateCostSloV1(request: CostSloEvaluationRequestV1): CostSloEvaluationV1 {
  const policyValidation = validateCostSloPolicyRevisionV1(request.policy);
  if (!policyValidation.valid) throw new Error(`Invalid cost/SLO policy: ${policyValidation.errors.join('; ')}`);
  if (!request.projectId.trim()) throw new Error('projectId is required');

  const evaluatedAtMs = Date.parse(request.evaluatedAt);
  if (!Number.isFinite(evaluatedAtMs)) throw new Error('evaluatedAt must be a valid timestamp');
  const windowStartedAtMs = evaluatedAtMs - request.policy.limits.evaluationWindowSeconds * 1000;
  const stageScope = new Set(request.policy.stageScope);
  const stageRunIds = new Set<string>();

  for (const event of request.telemetry) {
    const validation = validateAiStageTelemetryV1(event);
    if (!validation.valid) throw new Error(`Invalid stage telemetry ${event.stageRunId}: ${validation.errors.join('; ')}`);
    if (stageRunIds.has(event.stageRunId)) throw new Error(`Duplicate stageRunId: ${event.stageRunId}`);
    stageRunIds.add(event.stageRunId);
    if (Date.parse(event.completedAt) > evaluatedAtMs) throw new Error(`Telemetry ${event.stageRunId} completes after evaluatedAt`);
  }

  const scoped = request.telemetry.filter((event) => {
    const completedAtMs = Date.parse(event.completedAt);
    return event.correlation.projectId === request.projectId
      && stageScope.has(event.stage)
      && completedAtMs >= windowStartedAtMs
      && completedAtMs <= evaluatedAtMs;
  });
  const observed = scoped.filter((event) => event.outcome !== 'skipped');

  if (request.policy.requireCostEvidence) {
    for (const event of scoped) {
      if (!event.cost) throw new Error(`Telemetry ${event.stageRunId} is missing required cost evidence`);
      if (event.cost.currency !== request.policy.currency) {
        throw new Error(`Telemetry ${event.stageRunId} cost currency does not match policy currency`);
      }
    }
  } else {
    for (const event of scoped) {
      if (event.cost && event.cost.currency !== request.policy.currency) {
        throw new Error(`Telemetry ${event.stageRunId} cost currency does not match policy currency`);
      }
    }
  }

  const totalCostMicros = scoped.reduce((sum, event) => sum + (event.cost?.amountMicros ?? 0), 0);
  if (!Number.isSafeInteger(totalCostMicros)) throw new Error('Aggregated total cost exceeds safe integer range');
  const p95WallDurationMs = percentile95(observed.map((event) => event.usage.wallDurationMs));
  const failureCount = observed.filter((event) => event.outcome === 'failed').length;
  const failureRateBasisPoints = observed.length === 0 ? 0 : Math.ceil((failureCount * 10_000) / observed.length);

  const metrics: CostSloMetricEvidenceV1[] = [
    {
      metricId: 'total-cost-micros',
      value: totalCostMicros,
      limit: request.policy.limits.maxTotalCostMicrosPerProjectWindow,
      breached: totalCostMicros > request.policy.limits.maxTotalCostMicrosPerProjectWindow,
    },
    {
      metricId: 'p95-wall-duration-ms',
      value: p95WallDurationMs,
      limit: request.policy.limits.maxP95WallDurationMs,
      breached: p95WallDurationMs > request.policy.limits.maxP95WallDurationMs,
    },
    {
      metricId: 'failure-rate-basis-points',
      value: failureRateBasisPoints,
      limit: request.policy.limits.maxFailureRateBasisPoints,
      breached: failureRateBasisPoints > request.policy.limits.maxFailureRateBasisPoints,
    },
  ];

  const reasons: string[] = [];
  let status: CostSloEvaluationStatusV1;
  if (observed.length < request.policy.limits.minObservedStageRuns) {
    status = 'insufficient-evidence';
    reasons.push(`observed stage runs ${observed.length} below required minimum ${request.policy.limits.minObservedStageRuns}`);
  } else {
    const breached = metrics.filter((metric) => metric.breached);
    status = breached.length === 0 ? 'pass' : 'breach';
    reasons.push(...breached.map((metric) => `${metric.metricId} exceeded limit`));
  }

  return Object.freeze({
    policyId: request.policy.policyId,
    policyRevisionId: request.policy.revisionId,
    projectId: request.projectId,
    evaluatedAt: request.evaluatedAt,
    windowStartedAt: new Date(windowStartedAtMs).toISOString(),
    observedStageRuns: observed.length,
    scopedTelemetryRuns: scoped.length,
    status,
    metrics: Object.freeze(metrics.map((metric) => Object.freeze({ ...metric }))),
    reasons: Object.freeze([...reasons]),
  });
}
