import { describe, expect, it } from 'vitest';

import {
  DUPLICATE_CONTROL_RATIO_TOTAL_BASIS_POINTS,
  RETRIEVAL_DUPLICATE_CONTROL_POLICY_SCHEMA_VERSION,
  validateRetrievalDuplicateControlPolicy,
  type RetrievalDuplicateControlPolicy,
} from './retrieval-duplicate-control-policy.contract.js';

function validPolicy(): RetrievalDuplicateControlPolicy {
  return {
    schemaVersion: RETRIEVAL_DUPLICATE_CONTROL_POLICY_SCHEMA_VERSION,
    policyId: 'duplicate-control:same-source-overlap-v1',
    revisionId: 'duplicate-control-revision:same-source-overlap-v1',
    hybridPolicyRevisionId: 'retrieval-policy-revision:hybrid-v1',
    method: 'same-source-interval-iou-v1',
    maxResults: 50,
    maxSameSourceIntervalIouBasisPoints: 8_000,
    createdAt: '2026-08-27T00:20:00.000+07:00',
  };
}

describe('retrieval duplicate-control policy contract', () => {
  it('accepts a versioned deterministic policy pinned to one hybrid retrieval revision', () => {
    expect(validateRetrievalDuplicateControlPolicy(validPolicy())).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('requires exact hybrid-policy lineage', () => {
    const policy = validPolicy();
    policy.hybridPolicyRevisionId = ' ';

    const result = validateRetrievalDuplicateControlPolicy(policy);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('hybridPolicyRevisionId is required');
  });

  it('bounds result count and interval-IoU basis points with safe integers', () => {
    const policy = validPolicy();
    policy.maxResults = 1_001;
    policy.maxSameSourceIntervalIouBasisPoints = 8_000.5;

    const result = validateRetrievalDuplicateControlPolicy(policy);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('maxResults must be a safe integer between 1 and 1000');
    expect(result.errors).toContain(
      `maxSameSourceIntervalIouBasisPoints must be a safe integer between 1 and ${DUPLICATE_CONTROL_RATIO_TOTAL_BASIS_POINTS}`,
    );
  });

  it('rejects an unsupported method and malformed creation evidence', () => {
    const policy = {
      ...validPolicy(),
      method: 'perceptual-model-v1',
      createdAt: 'not-a-timestamp',
    } as unknown as RetrievalDuplicateControlPolicy;

    const result = validateRetrievalDuplicateControlPolicy(policy);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('unsupported duplicate-control method');
    expect(result.errors).toContain('createdAt must be an ISO-compatible timestamp');
  });

  it('keeps reranking, perceptual duplicate models and editorial scoring outside this contract', () => {
    const policy = validPolicy();

    expect('reranker' in policy).toBe(false);
    expect('perceptualModel' in policy).toBe(false);
    expect('editorialScore' in policy).toBe(false);
  });
});