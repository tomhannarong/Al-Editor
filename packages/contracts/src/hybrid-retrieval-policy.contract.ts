export const HYBRID_RETRIEVAL_POLICY_SCHEMA_VERSION = '1.0' as const;

export const HYBRID_RETRIEVAL_WEIGHT_TOTAL_BASIS_POINTS = 10_000 as const;

export interface HybridRetrievalBenchmarkControl {
  benchmarkId: string;
  benchmarkRevisionId: string;
  baselinePolicyRevisionId: string;
}

export interface HybridRetrievalRepresentationPolicy {
  representationId: string;
  representationRevisionId: string;
  embeddingRevisionId: string;
  modelId: string;
  modelVersion: string;
  weightBasisPoints: number;
}

/**
 * Phase-5 hybrid retrieval policy. This contract pins immutable comparison,
 * representation and weighting evidence only. Reranking, duplicate-control
 * behavior and editorial scoring are intentionally separate later slices.
 */
export interface HybridRetrievalPolicy {
  schemaVersion: typeof HYBRID_RETRIEVAL_POLICY_SCHEMA_VERSION;
  policyId: string;
  revisionId: string;
  benchmarkControl: HybridRetrievalBenchmarkControl;
  fusionMethod: 'weighted-cosine-score-v1';
  candidatePoolSize: number;
  representations: HybridRetrievalRepresentationPolicy[];
  createdAt: string;
}

export interface HybridRetrievalPolicyValidationResult {
  valid: boolean;
  errors: string[];
}

const MAX_CANDIDATE_POOL_SIZE = 1_000;

function required(value: string): boolean {
  return value.trim().length > 0;
}

function representationIdentity(representation: HybridRetrievalRepresentationPolicy): string {
  return [
    representation.representationId,
    representation.representationRevisionId,
    representation.embeddingRevisionId,
    representation.modelId,
    representation.modelVersion,
  ].join('|');
}

export function validateHybridRetrievalPolicy(
  policy: HybridRetrievalPolicy,
): HybridRetrievalPolicyValidationResult {
  const errors: string[] = [];

  if (policy.schemaVersion !== HYBRID_RETRIEVAL_POLICY_SCHEMA_VERSION) {
    errors.push('unsupported hybrid retrieval policy schemaVersion');
  }
  if (!required(policy.policyId)) errors.push('policyId is required');
  if (!required(policy.revisionId)) errors.push('revisionId is required');
  if (!required(policy.benchmarkControl.benchmarkId)) {
    errors.push('benchmarkControl.benchmarkId is required');
  }
  if (!required(policy.benchmarkControl.benchmarkRevisionId)) {
    errors.push('benchmarkControl.benchmarkRevisionId is required');
  }
  if (!required(policy.benchmarkControl.baselinePolicyRevisionId)) {
    errors.push('benchmarkControl.baselinePolicyRevisionId is required');
  }
  if (policy.fusionMethod !== 'weighted-cosine-score-v1') {
    errors.push('unsupported fusionMethod');
  }
  if (
    !Number.isSafeInteger(policy.candidatePoolSize)
    || policy.candidatePoolSize < 1
    || policy.candidatePoolSize > MAX_CANDIDATE_POOL_SIZE
  ) {
    errors.push(`candidatePoolSize must be a safe integer between 1 and ${MAX_CANDIDATE_POOL_SIZE}`);
  }
  if (policy.representations.length < 2) {
    errors.push('hybrid retrieval requires at least two pinned representations');
  }
  if (Number.isNaN(Date.parse(policy.createdAt))) {
    errors.push('createdAt must be an ISO-compatible timestamp');
  }

  const seenIdentities = new Set<string>();
  let weightTotal = 0;

  for (const [index, representation] of policy.representations.entries()) {
    if (!required(representation.representationId)) {
      errors.push(`representations[${index}].representationId is required`);
    }
    if (!required(representation.representationRevisionId)) {
      errors.push(`representations[${index}].representationRevisionId is required`);
    }
    if (!required(representation.embeddingRevisionId)) {
      errors.push(`representations[${index}].embeddingRevisionId is required`);
    }
    if (!required(representation.modelId)) {
      errors.push(`representations[${index}].modelId is required`);
    }
    if (!required(representation.modelVersion)) {
      errors.push(`representations[${index}].modelVersion is required`);
    }
    if (
      !Number.isSafeInteger(representation.weightBasisPoints)
      || representation.weightBasisPoints <= 0
      || representation.weightBasisPoints > HYBRID_RETRIEVAL_WEIGHT_TOTAL_BASIS_POINTS
    ) {
      errors.push(
        `representations[${index}].weightBasisPoints must be a positive safe integer at most ${HYBRID_RETRIEVAL_WEIGHT_TOTAL_BASIS_POINTS}`,
      );
    } else {
      weightTotal += representation.weightBasisPoints;
    }

    const identity = representationIdentity(representation);
    if (seenIdentities.has(identity)) {
      errors.push(`duplicate pinned representation at representations[${index}]`);
    }
    seenIdentities.add(identity);
  }

  if (weightTotal !== HYBRID_RETRIEVAL_WEIGHT_TOTAL_BASIS_POINTS) {
    errors.push(
      `representation weights must sum to ${HYBRID_RETRIEVAL_WEIGHT_TOTAL_BASIS_POINTS} basis points`,
    );
  }

  return { valid: errors.length === 0, errors };
}
