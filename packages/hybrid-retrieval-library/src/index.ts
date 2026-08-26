import {
  validateHybridRetrievalPolicy,
  type HybridRetrievalPolicy,
  type HybridRetrievalRepresentationPolicy,
} from '../../contracts/src/hybrid-retrieval-policy.contract.js';

export * from './execution.js';

export class HybridRetrievalPolicyPersistenceInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HybridRetrievalPolicyPersistenceInvariantError';
  }
}

export interface RegisterHybridRetrievalPolicyResult {
  policy: HybridRetrievalPolicy;
  created: boolean;
}

/**
 * Immutable metadata boundary for Phase-5 hybrid retrieval policy evidence.
 *
 * revisionId is immutable evidence identity. Re-registering the same semantic
 * policy is idempotent; reusing that revisionId with changed benchmark control,
 * representation/model revisions, weights, fusion method, candidate pool or
 * creation evidence fails closed. Runtime candidates, scores and Qdrant state
 * intentionally do not belong to this store.
 */
export interface HybridRetrievalPolicyPersistence {
  registerPolicy(candidate: HybridRetrievalPolicy): RegisterHybridRetrievalPolicyResult;
  getPolicy(revisionId: string): HybridRetrievalPolicy | undefined;
}

export class InMemoryHybridRetrievalPolicyStore implements HybridRetrievalPolicyPersistence {
  readonly #policies = new Map<string, HybridRetrievalPolicy>();

  registerPolicy(candidate: HybridRetrievalPolicy): RegisterHybridRetrievalPolicyResult {
    assertValidPolicy(candidate);
    const normalizedCandidate = cloneNormalizedPolicy(candidate);
    const existing = this.#policies.get(candidate.revisionId);

    if (existing) {
      if (!sameImmutableHybridRetrievalPolicy(existing, normalizedCandidate)) {
        throw new HybridRetrievalPolicyPersistenceInvariantError(
          `hybrid retrieval revisionId ${candidate.revisionId} conflicts with existing immutable policy`,
        );
      }
      return { policy: cloneNormalizedPolicy(existing), created: false };
    }

    this.#policies.set(normalizedCandidate.revisionId, normalizedCandidate);
    return { policy: cloneNormalizedPolicy(normalizedCandidate), created: true };
  }

  getPolicy(revisionId: string): HybridRetrievalPolicy | undefined {
    const stored = this.#policies.get(revisionId);
    return stored ? cloneNormalizedPolicy(stored) : undefined;
  }
}

export function sameImmutableHybridRetrievalPolicy(
  left: HybridRetrievalPolicy,
  right: HybridRetrievalPolicy,
): boolean {
  const normalizedLeft = cloneNormalizedPolicy(left);
  const normalizedRight = cloneNormalizedPolicy(right);

  if (
    normalizedLeft.schemaVersion !== normalizedRight.schemaVersion
    || normalizedLeft.policyId !== normalizedRight.policyId
    || normalizedLeft.revisionId !== normalizedRight.revisionId
    || normalizedLeft.benchmarkControl.benchmarkId !== normalizedRight.benchmarkControl.benchmarkId
    || normalizedLeft.benchmarkControl.benchmarkRevisionId
      !== normalizedRight.benchmarkControl.benchmarkRevisionId
    || normalizedLeft.benchmarkControl.baselinePolicyRevisionId
      !== normalizedRight.benchmarkControl.baselinePolicyRevisionId
    || normalizedLeft.fusionMethod !== normalizedRight.fusionMethod
    || normalizedLeft.candidatePoolSize !== normalizedRight.candidatePoolSize
    || normalizedLeft.createdAt !== normalizedRight.createdAt
    || normalizedLeft.representations.length !== normalizedRight.representations.length
  ) {
    return false;
  }

  return normalizedLeft.representations.every((representation, index) => {
    const other = normalizedRight.representations[index];
    return other !== undefined && sameRepresentation(representation, other);
  });
}

function assertValidPolicy(candidate: HybridRetrievalPolicy): void {
  const validation = validateHybridRetrievalPolicy(candidate);
  if (!validation.valid) {
    throw new HybridRetrievalPolicyPersistenceInvariantError(validation.errors.join('; '));
  }
}

function cloneNormalizedPolicy(policy: HybridRetrievalPolicy): HybridRetrievalPolicy {
  return {
    ...policy,
    benchmarkControl: { ...policy.benchmarkControl },
    representations: policy.representations
      .map((representation) => ({ ...representation }))
      .sort(compareRepresentations),
  };
}

function compareRepresentations(
  left: HybridRetrievalRepresentationPolicy,
  right: HybridRetrievalRepresentationPolicy,
): number {
  return representationSortKey(left).localeCompare(representationSortKey(right));
}

function representationSortKey(representation: HybridRetrievalRepresentationPolicy): string {
  return [
    representation.representationId,
    representation.representationRevisionId,
    representation.embeddingRevisionId,
    representation.modelId,
    representation.modelVersion,
  ].join('\u0000');
}

function sameRepresentation(
  left: HybridRetrievalRepresentationPolicy,
  right: HybridRetrievalRepresentationPolicy,
): boolean {
  return left.representationId === right.representationId
    && left.representationRevisionId === right.representationRevisionId
    && left.embeddingRevisionId === right.embeddingRevisionId
    && left.modelId === right.modelId
    && left.modelVersion === right.modelVersion
    && left.weightBasisPoints === right.weightBasisPoints;
}
