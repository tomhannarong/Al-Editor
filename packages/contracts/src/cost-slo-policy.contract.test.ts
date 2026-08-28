import { describe, expect, it } from 'vitest';
import {
  COST_SLO_POLICY_AUTHORITY,
  COST_SLO_POLICY_SCHEMA_VERSION,
  validateCostSloPolicyRevisionV1,
  type CostSloPolicyRevisionV1,
} from './cost-slo-policy.contract.js';

function policy(): CostSloPolicyRevisionV1 {
  return {
    schemaVersion: COST_SLO_POLICY_SCHEMA_VERSION,
    authority: COST_SLO_POLICY_AUTHORITY,
    policyId: 'cost-slo:phase13',
    revisionId: 'cost-slo:phase13:r1',
    owner: 'platform-operations',
    stageScope: ['ingest', 'analyze', 'retrieve', 'plan', 'preview-render', 'final-render', 'export'],
    currency: 'USD',
    requireCostEvidence: true,
    limits: {
      evaluationWindowSeconds: 3600,
      minObservedStageRuns: 3,
      maxTotalCostMicrosPerProjectWindow: 5_000_000,
      maxP95WallDurationMs: 30_000,
      maxFailureRateBasisPoints: 500,
    },
    createdAt: '2026-08-28T03:00:00.000Z',
  };
}

describe('cost/SLO policy v1', () => {
  it('accepts the pinned Phase-13 evaluation-only policy', () => {
    expect(validateCostSloPolicyRevisionV1(policy())).toEqual({ valid: true, errors: [] });
  });

  it('rejects mutable revision aliases and correctness-authority escalation', () => {
    const value = policy();
    value.revisionId = 'latest';
    (value as { authority: string }).authority = 'correctness-authority';
    const result = validateCostSloPolicyRevisionV1(value);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('revisionId must be pinned and must not use a mutable alias');
    expect(result.errors).toContain('authority must be evaluation-only');
  });

  it('requires unique supported stages and a currency identity', () => {
    const value = policy();
    value.stageScope = ['ingest', 'ingest'];
    value.currency = 'usd';
    const result = validateCostSloPolicyRevisionV1(value);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('stageScope[1] must be unique');
    expect(result.errors).toContain('currency must be an uppercase ISO-style code');
  });

  it('requires bounded explicit metric/window limits', () => {
    const value = policy();
    value.limits.evaluationWindowSeconds = 0;
    value.limits.minObservedStageRuns = 0;
    value.limits.maxFailureRateBasisPoints = 10_001;
    const result = validateCostSloPolicyRevisionV1(value);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('limits.evaluationWindowSeconds must be a positive safe integer');
    expect(result.errors).toContain('limits.minObservedStageRuns must be a positive safe integer');
    expect(result.errors).toContain('limits.maxFailureRateBasisPoints must be a safe integer from 0 to 10000');
  });
});
