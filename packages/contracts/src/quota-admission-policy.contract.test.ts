import { describe, expect, it } from 'vitest';
import {
  QUOTA_ADMISSION_POLICY_AUTHORITY,
  QUOTA_ADMISSION_POLICY_SCHEMA_VERSION,
  validateQuotaAdmissionPolicyRevisionV1,
  type QuotaAdmissionPolicyRevisionV1,
} from './quota-admission-policy.contract.js';

function policy(): QuotaAdmissionPolicyRevisionV1 {
  return {
    schemaVersion: QUOTA_ADMISSION_POLICY_SCHEMA_VERSION,
    authority: QUOTA_ADMISSION_POLICY_AUTHORITY,
    policyId: 'quota-admission:phase13',
    revisionId: 'quota-admission:phase13:r1',
    owner: 'platform-operations',
    stageScope: ['ingest', 'analyze', 'retrieve', 'plan', 'preview-render', 'final-render', 'export'],
    limits: {
      maxInFlightJobsPerProject: 8,
      maxActiveJobsPerProject: 3,
      stageStartWindowSeconds: 60,
      maxStageStartsPerProjectPerWindow: 20,
      maxEstimatedInputBytesPerAdmission: 10_000_000_000,
      maxEstimatedMediaDurationMsPerAdmission: 7_200_000,
    },
    createdAt: '2026-08-28T01:30:00.000Z',
  };
}

describe('quota admission policy v1', () => {
  it('accepts the pinned Phase-13 policy shape', () => {
    expect(validateQuotaAdmissionPolicyRevisionV1(policy())).toEqual({ valid: true, errors: [] });
  });

  it('rejects mutable revision aliases and authority escalation', () => {
    const value = policy();
    value.revisionId = 'latest';
    (value as { authority: string }).authority = 'correctness-authority';
    const result = validateQuotaAdmissionPolicyRevisionV1(value);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('revisionId must be pinned and must not use a mutable alias');
    expect(result.errors).toContain('authority must be admission-only');
  });

  it('requires unique supported stages', () => {
    const value = policy();
    value.stageScope = ['ingest', 'ingest'];
    const result = validateQuotaAdmissionPolicyRevisionV1(value);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('stageScope[1] must be unique');
  });

  it('requires positive safe integer limits and a bounded active subset', () => {
    const value = policy();
    value.limits.maxInFlightJobsPerProject = 2;
    value.limits.maxActiveJobsPerProject = 3;
    value.limits.stageStartWindowSeconds = 0;
    const result = validateQuotaAdmissionPolicyRevisionV1(value);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('limits.stageStartWindowSeconds must be a positive safe integer');
    expect(result.errors).toContain('limits.maxActiveJobsPerProject cannot exceed maxInFlightJobsPerProject');
  });
});
