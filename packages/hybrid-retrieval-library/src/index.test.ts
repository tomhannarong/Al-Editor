import { describe, expect, it } from 'vitest';

import {
  HYBRID_RETRIEVAL_POLICY_SCHEMA_VERSION,
  type HybridRetrievalPolicy,
} from '../../contracts/src/hybrid-retrieval-policy.contract.js';
import {
  HybridRetrievalPolicyPersistenceInvariantError,
  InMemoryHybridRetrievalPolicyStore,
  sameImmutableHybridRetrievalPolicy,
} from './index.js';

function validPolicy(overrides: Partial<HybridRetrievalPolicy> = {}): HybridRetrievalPolicy {
  return {
    schemaVersion: HYBRID_RETRIEVAL_POLICY_SCHEMA_VERSION,
    policyId: 'hybrid-policy:travel-scenes',
    revisionId: 'hybrid-policy-revision:v1',
    benchmarkControl: {
      benchmarkId: 'phase4-labeled-recall-at-10',
      benchmarkRevisionId: 'phase4-labeled-recall-at-10:v1',
      baselinePolicyRevisionId: 'single-vector-baseline:v1',
    },
    fusionMethod: 'weighted-cosine-score-v1',
    candidatePoolSize: 50,
    representations: [
      {
        representationId: 'scene-caption',
        representationRevisionId: 'scene-caption:v2',
        embeddingRevisionId: 'embedding:text:v3',
        modelId: 'text-embedding-local',
        modelVersion: '3.0.0',
        weightBasisPoints: 6_000,
      },
      {
        representationId: 'visual-tags',
        representationRevisionId: 'visual-tags:v4',
        embeddingRevisionId: 'embedding:visual-tags:v2',
        modelId: 'visual-embedding-local',
        modelVersion: '2.1.0',
        weightBasisPoints: 4_000,
      },
    ],
    createdAt: '2026-08-26T14:30:00.000Z',
    ...overrides,
  };
}

describe('hybrid retrieval policy persistence', () => {
  it('registers immutable policy evidence and returns deep defensive copies', () => {
    const store = new InMemoryHybridRetrievalPolicyStore();
    const candidate = validPolicy();

    const first = store.registerPolicy(candidate);
    expect(first.created).toBe(true);

    first.policy.benchmarkControl.benchmarkRevisionId = 'mutated';
    first.policy.representations[0]!.modelVersion = 'mutated';

    expect(store.getPolicy(candidate.revisionId)).toEqual(validPolicy());
  });

  it('treats representation ordering as non-semantic for idempotent re-registration', () => {
    const store = new InMemoryHybridRetrievalPolicyStore();
    expect(store.registerPolicy(validPolicy()).created).toBe(true);

    const reordered = validPolicy();
    reordered.representations = [...reordered.representations].reverse();

    const result = store.registerPolicy(reordered);
    expect(result.created).toBe(false);
    expect(result.policy.representations.map((item) => item.representationId))
      .toEqual(['scene-caption', 'visual-tags']);
  });

  it('fails closed when benchmark control changes under the same revisionId', () => {
    const store = new InMemoryHybridRetrievalPolicyStore();
    store.registerPolicy(validPolicy());

    const changed = validPolicy();
    changed.benchmarkControl = {
      ...changed.benchmarkControl,
      benchmarkRevisionId: 'phase4-labeled-recall-at-10:v2',
    };

    expect(() => store.registerPolicy(changed))
      .toThrow(HybridRetrievalPolicyPersistenceInvariantError);
    expect(store.getPolicy(changed.revisionId)?.benchmarkControl.benchmarkRevisionId)
      .toBe('phase4-labeled-recall-at-10:v1');
  });

  it('fails closed when representation, model or weighting evidence changes', () => {
    const store = new InMemoryHybridRetrievalPolicyStore();
    store.registerPolicy(validPolicy());

    const changedModel = validPolicy();
    changedModel.representations[0] = {
      ...changedModel.representations[0]!,
      modelVersion: '3.1.0',
    };
    expect(() => store.registerPolicy(changedModel))
      .toThrow(HybridRetrievalPolicyPersistenceInvariantError);

    const changedWeights = validPolicy();
    changedWeights.representations = changedWeights.representations.map((item, index) => ({
      ...item,
      weightBasisPoints: index === 0 ? 5_500 : 4_500,
    }));
    expect(() => store.registerPolicy(changedWeights))
      .toThrow(HybridRetrievalPolicyPersistenceInvariantError);
  });

  it('fails closed when fusion, candidate pool or creation evidence changes', () => {
    const store = new InMemoryHybridRetrievalPolicyStore();
    store.registerPolicy(validPolicy());

    expect(() => store.registerPolicy(validPolicy({ candidatePoolSize: 75 })))
      .toThrow(HybridRetrievalPolicyPersistenceInvariantError);
    expect(() => store.registerPolicy(validPolicy({ createdAt: '2026-08-26T14:31:00.000Z' })))
      .toThrow(HybridRetrievalPolicyPersistenceInvariantError);
  });

  it('requires a new revision for a policy upgrade and preserves history', () => {
    const store = new InMemoryHybridRetrievalPolicyStore();
    store.registerPolicy(validPolicy());

    const next = validPolicy({
      revisionId: 'hybrid-policy-revision:v2',
      candidatePoolSize: 75,
      representations: [
        {
          ...validPolicy().representations[0]!,
          weightBasisPoints: 5_500,
        },
        {
          ...validPolicy().representations[1]!,
          weightBasisPoints: 4_500,
        },
      ],
      createdAt: '2026-08-26T14:35:00.000Z',
    });

    expect(store.registerPolicy(next).created).toBe(true);
    expect(store.getPolicy('hybrid-policy-revision:v1')?.candidatePoolSize).toBe(50);
    expect(store.getPolicy('hybrid-policy-revision:v2')?.candidatePoolSize).toBe(75);
  });

  it('rejects invalid evidence before persistence and compares complete immutable semantics', () => {
    const store = new InMemoryHybridRetrievalPolicyStore();
    const invalid = validPolicy({ candidatePoolSize: 0 });

    expect(() => store.registerPolicy(invalid))
      .toThrow(HybridRetrievalPolicyPersistenceInvariantError);
    expect(store.getPolicy(invalid.revisionId)).toBeUndefined();

    const left = validPolicy();
    const right = validPolicy({ createdAt: '2026-08-26T14:32:00.000Z' });
    expect(sameImmutableHybridRetrievalPolicy(left, right)).toBe(false);
  });
});
