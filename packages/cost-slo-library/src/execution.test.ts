import { describe, expect, it } from 'vitest';
import {
  AI_STAGE_TELEMETRY_AUTHORITY,
  AI_STAGE_TELEMETRY_SCHEMA_VERSION,
  type AiStageTelemetryV1,
} from '../../contracts/src/cost-performance-telemetry.contract.js';
import {
  COST_SLO_POLICY_AUTHORITY,
  COST_SLO_POLICY_SCHEMA_VERSION,
  type CostSloPolicyRevisionV1,
} from '../../contracts/src/cost-slo-policy.contract.js';
import { evaluateCostSloV1 } from './execution.js';

function policy(): CostSloPolicyRevisionV1 {
  return {
    schemaVersion: COST_SLO_POLICY_SCHEMA_VERSION,
    authority: COST_SLO_POLICY_AUTHORITY,
    policyId: 'cost-slo:phase13',
    revisionId: 'cost-slo:phase13:r1',
    owner: 'platform-operations',
    stageScope: ['retrieve', 'plan', 'final-render'],
    currency: 'USD',
    requireCostEvidence: true,
    limits: {
      evaluationWindowSeconds: 3600,
      minObservedStageRuns: 3,
      maxTotalCostMicrosPerProjectWindow: 1_000_000,
      maxP95WallDurationMs: 5_000,
      maxFailureRateBasisPoints: 3_500,
    },
    createdAt: '2026-08-28T03:00:00.000Z',
  };
}

function telemetry(
  stageRunId: string,
  completedAt: string,
  wallDurationMs: number,
  amountMicros: number,
  outcome: AiStageTelemetryV1['outcome'] = 'succeeded',
  projectId = 'project:1',
): AiStageTelemetryV1 {
  const base = {
    schemaVersion: AI_STAGE_TELEMETRY_SCHEMA_VERSION,
    authority: AI_STAGE_TELEMETRY_AUTHORITY,
    stageRunId,
    stage: 'retrieve' as const,
    outcome,
    startedAt: completedAt,
    completedAt,
    correlation: { projectId },
    usage: { wallDurationMs },
    cost: { currency: 'USD', amountMicros, pricingVersion: 'pricing:r1' },
  };
  return outcome === 'failed' ? { ...base, errorCode: 'STAGE_FAILED' } : base;
}

describe('cost/SLO evaluator v1', () => {
  it('passes explicit cost, p95 latency and failure-rate limits over the bounded project window', () => {
    const result = evaluateCostSloV1({
      policy: policy(),
      projectId: 'project:1',
      evaluatedAt: '2026-08-28T04:00:00.000Z',
      telemetry: [
        telemetry('run:1', '2026-08-28T03:10:00.000Z', 100, 100_000),
        telemetry('run:2', '2026-08-28T03:20:00.000Z', 200, 200_000),
        telemetry('run:3', '2026-08-28T03:30:00.000Z', 300, 300_000),
        telemetry('other-project', '2026-08-28T03:40:00.000Z', 99_999, 9_000_000, 'failed', 'project:2'),
        telemetry('outside-window', '2026-08-28T02:59:59.000Z', 99_999, 9_000_000, 'failed'),
      ],
    });
    expect(result.status).toBe('pass');
    expect(result.observedStageRuns).toBe(3);
    expect(result.metrics).toEqual([
      { metricId: 'total-cost-micros', value: 600_000, limit: 1_000_000, breached: false },
      { metricId: 'p95-wall-duration-ms', value: 300, limit: 5_000, breached: false },
      { metricId: 'failure-rate-basis-points', value: 0, limit: 3_500, breached: false },
    ]);
  });

  it('reports deterministic breaches without becoming correctness authority', () => {
    const result = evaluateCostSloV1({
      policy: policy(),
      projectId: 'project:1',
      evaluatedAt: '2026-08-28T04:00:00.000Z',
      telemetry: [
        telemetry('run:1', '2026-08-28T03:10:00.000Z', 100, 600_000),
        telemetry('run:2', '2026-08-28T03:20:00.000Z', 7_000, 600_000, 'failed'),
        telemetry('run:3', '2026-08-28T03:30:00.000Z', 200, 10_000),
      ],
    });
    expect(result.status).toBe('breach');
    expect(result.reasons).toEqual([
      'total-cost-micros exceeded limit',
      'p95-wall-duration-ms exceeded limit',
    ]);
    expect(result.metrics.find((metric) => metric.metricId === 'failure-rate-basis-points')?.value).toBe(3334);
  });

  it('returns insufficient evidence instead of inventing an SLO pass', () => {
    const result = evaluateCostSloV1({
      policy: policy(),
      projectId: 'project:1',
      evaluatedAt: '2026-08-28T04:00:00.000Z',
      telemetry: [telemetry('run:1', '2026-08-28T03:10:00.000Z', 100, 100)],
    });
    expect(result.status).toBe('insufficient-evidence');
    expect(result.reasons).toEqual(['observed stage runs 1 below required minimum 3']);
  });

  it('fails closed on duplicate, future, malformed or missing required cost evidence', () => {
    const duplicate = telemetry('run:1', '2026-08-28T03:10:00.000Z', 100, 100);
    expect(() => evaluateCostSloV1({
      policy: policy(),
      projectId: 'project:1',
      evaluatedAt: '2026-08-28T04:00:00.000Z',
      telemetry: [duplicate, duplicate],
    })).toThrow('Duplicate stageRunId: run:1');

    expect(() => evaluateCostSloV1({
      policy: policy(),
      projectId: 'project:1',
      evaluatedAt: '2026-08-28T04:00:00.000Z',
      telemetry: [telemetry('future', '2026-08-28T04:00:01.000Z', 100, 100)],
    })).toThrow('completes after evaluatedAt');

    const missingCost = telemetry('missing-cost', '2026-08-28T03:10:00.000Z', 100, 100);
    delete missingCost.cost;
    expect(() => evaluateCostSloV1({
      policy: policy(),
      projectId: 'project:1',
      evaluatedAt: '2026-08-28T04:00:00.000Z',
      telemetry: [missingCost],
    })).toThrow('is missing required cost evidence');
  });

  it('fails closed on mixed currencies and preserves skipped-run denominator semantics', () => {
    const mixed = telemetry('mixed', '2026-08-28T03:10:00.000Z', 100, 100);
    mixed.cost = { currency: 'THB', amountMicros: 100, pricingVersion: 'pricing:r1' };
    expect(() => evaluateCostSloV1({
      policy: policy(),
      projectId: 'project:1',
      evaluatedAt: '2026-08-28T04:00:00.000Z',
      telemetry: [mixed],
    })).toThrow('cost currency does not match policy currency');

    const relaxed = policy();
    relaxed.limits.minObservedStageRuns = 1;
    const result = evaluateCostSloV1({
      policy: relaxed,
      projectId: 'project:1',
      evaluatedAt: '2026-08-28T04:00:00.000Z',
      telemetry: [
        telemetry('run:1', '2026-08-28T03:10:00.000Z', 100, 100),
        telemetry('skip:1', '2026-08-28T03:20:00.000Z', 5_000, 50, 'skipped'),
      ],
    });
    expect(result.observedStageRuns).toBe(1);
    expect(result.scopedTelemetryRuns).toBe(2);
    expect(result.metrics.find((metric) => metric.metricId === 'total-cost-micros')?.value).toBe(150);
  });
});
