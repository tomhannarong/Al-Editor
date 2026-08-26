export const RETRIEVAL_DUPLICATE_CONTROL_POLICY_SCHEMA_VERSION = '1.0' as const;

export const DUPLICATE_CONTROL_RATIO_TOTAL_BASIS_POINTS = 10_000 as const;

export interface RetrievalDuplicateControlPolicy {
  schemaVersion: typeof RETRIEVAL_DUPLICATE_CONTROL_POLICY_SCHEMA_VERSION;
  policyId: string;
  revisionId: string;
  hybridPolicyRevisionId: string;
  method: 'same-source-interval-iou-v1';
  maxResults: number;
  maxSameSourceIntervalIouBasisPoints: number;
  createdAt: string;
}

export interface RetrievalDuplicateControlPolicyValidationResult {
  valid: boolean;
  errors: string[];
}

const MAX_RESULTS = 1_000;

function required(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Phase-5 deterministic duplicate-control policy. It suppresses candidates only
 * when they map to the same immutable asset/stream and their native-PTS source
 * intervals exceed the configured IoU threshold. Semantic/perceptual duplicate
 * detection, reranking and editorial judgment remain separate capabilities.
 */
export function validateRetrievalDuplicateControlPolicy(
  policy: RetrievalDuplicateControlPolicy,
): RetrievalDuplicateControlPolicyValidationResult {
  const errors: string[] = [];

  if (policy.schemaVersion !== RETRIEVAL_DUPLICATE_CONTROL_POLICY_SCHEMA_VERSION) {
    errors.push('unsupported retrieval duplicate-control policy schemaVersion');
  }
  if (!required(policy.policyId)) errors.push('policyId is required');
  if (!required(policy.revisionId)) errors.push('revisionId is required');
  if (!required(policy.hybridPolicyRevisionId)) {
    errors.push('hybridPolicyRevisionId is required');
  }
  if (policy.method !== 'same-source-interval-iou-v1') {
    errors.push('unsupported duplicate-control method');
  }
  if (
    !Number.isSafeInteger(policy.maxResults)
    || policy.maxResults < 1
    || policy.maxResults > MAX_RESULTS
  ) {
    errors.push(`maxResults must be a safe integer between 1 and ${MAX_RESULTS}`);
  }
  if (
    !Number.isSafeInteger(policy.maxSameSourceIntervalIouBasisPoints)
    || policy.maxSameSourceIntervalIouBasisPoints < 1
    || policy.maxSameSourceIntervalIouBasisPoints > DUPLICATE_CONTROL_RATIO_TOTAL_BASIS_POINTS
  ) {
    errors.push(
      `maxSameSourceIntervalIouBasisPoints must be a safe integer between 1 and ${DUPLICATE_CONTROL_RATIO_TOTAL_BASIS_POINTS}`,
    );
  }
  if (Number.isNaN(Date.parse(policy.createdAt))) {
    errors.push('createdAt must be an ISO-compatible timestamp');
  }

  return { valid: errors.length === 0, errors };
}
