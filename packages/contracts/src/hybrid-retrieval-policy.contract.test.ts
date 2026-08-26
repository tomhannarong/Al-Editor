import { describe, expect, it } from 'vitest';

import {
  HYBRID_RETRIEVAL_POLICY_SCHEMA_VERSION,
  HYBRID_RETRIEVAL_WEIGHT_TOTAL_BASIS_POINTS,
  validateHybridRetrievalPolicy,
  type HybridRetrievalPolicy,
} from './hybrid-retrieval-policy.contract.js';

function validPolicy(): HybridRetrievalPolicy {
  return {
    schemaVersion: HYBRID_RETRIEVAL_POLICY_SCHEMA_VERSION,
    policyId: 'retrieval-policy:hybrid-v1',
    revisionId: 'retrieval-policy-revision:hybrid-v1',
    benchmarkControl: {
      benchmarkId: 'phase4-labeled-recall-at-10',
      benchmarkRevisionId: 'phase4-labeled-recall-at-10:v1',
      baselinePolicyRevisionId: 'phase4-single-vector-cosine:v1',
    },
    fusionMethod: 'weighted-cosine-score-v1',
    candidatePoolSize: 50,
    representations: [
      {
        representationId: 'scene-text',
        representationRevisionId: 'scene-text:v1',
        embeddingRevisionId: 'scene-text-embedding:v1',
        modelId: 'text-embedding-model',
        modelVersion: '1.0.0',
        weightBasisPoints: 6_000,
      },
      {
        representationId: 'scene-visual',
        representationRevisionId: 'scene-visual:v1',
        embeddingRevisionId: 'scene-visual-embedding:v1',
        modelId: 'visual-embedding-model',
        modelVersion: '1.0.0',
        weightBasisPoints: 4_000,
      },
    ],
    createdAt: '2026-08-26T13:30:00.000Z',
  };
}

describe('hybrid retrieval policy contract', () => {
  it('accepts a versioned policy pinned to the Phase-4 benchmark control and explicit representation weights', () => {
    expect(validateHybridRetrievalPolicy(validPolicy())).toEqual({ valid: true, errors: [] });
  });

  it('requires at least two pinned representations', () => {
    const policy = validPolicy();
    policy.representations = [
      {
        ...policy.representations[0]!,
        weightBasisPoints: HYBRID_RETRIEVAL_WEIGHT_TOTAL_BASIS_POINTS,
      },
    ];

    const result = validateHybridRetrievalPolicy(policy);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('hybrid retrieval requires at least two pinned representations');
  });

  it('requires deterministic integer basis-point weights that sum exactly to 10000', () => {
    const policy = validPolicy();
    policy.representations[0]!.weightBasisPoints = 5_999;
    policy.representations[1]!.weightBasisPoints = 4_000.5;

    const result = validateHybridRetrievalPolicy(policy);
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('weightBasisPoints must be a positive safe integer');
    expect(result.errors).toContain('representation weights must sum to 10000 basis points');
  });

  it('rejects missing benchmark-control and model-version evidence', () => {
    const policy = validPolicy();
    policy.benchmarkControl.benchmarkRevisionId = ' ';
    policy.representations[1]!.modelVersion = '';

    const result = validateHybridRetrievalPolicy(policy);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('benchmarkControl.benchmarkRevisionId is required');
    expect(result.errors).toContain('representations[1].modelVersion is required');
  });

  it('rejects duplicate exact pinned representation evidence', () => {
    const policy = validPolicy();
    policy.representations[1] = {
      ...policy.representations[0]!,
      weightBasisPoints: 4_000,
    };

    const result = validateHybridRetrievalPolicy(policy);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('duplicate pinned representation at representations[1]');
  });

  it('bounds candidate pool size without adding reranking or editorial-scoring policy', () => {
    const policy = validPolicy();
    policy.candidatePoolSize = 1_001;

    const result = validateHybridRetrievalPolicy(policy);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('candidatePoolSize must be a safe integer between 1 and 1000');
    expect('reranker' in policy).toBe(false);
    expect('duplicateControl' in policy).toBe(false);
    expect('editorialScore' in policy).toBe(false);
  });
});
