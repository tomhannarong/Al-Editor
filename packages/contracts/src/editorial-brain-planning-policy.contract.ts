export const EDITORIAL_BRAIN_PLANNING_POLICY_SCHEMA_VERSION = '1.0' as const;

export const PHASE8_EDITORIAL_QUALITY_BASELINE_REVISION_ID =
  'phase8-editorial-quality-baseline:v1' as const;

export type EditorialBrainPlanningMethod = 'deterministic-style-guided-greedy-v1';

export interface EditorialBrainBenchmarkControl {
  benchmarkRevisionId: string;
  fixtureRevisionId: string;
  controlPlanRevisionId: string;
  evaluationPolicyRevisionId: string;
}

export interface EditorialBrainStyleProfileRef {
  profileId: string;
  profileVersion: string;
}

/**
 * Explicit editorial objectives only. Retrieval relevance remains upstream and
 * separate from this policy. Duration preferences are resolved through the
 * referenced Style Profile and never become canonical timing authority here.
 */
export interface EditorialBrainPlanningObjectives {
  pacing: 'style-duration-fit-v1';
  continuity: 'adjacent-continuity-group-v1';
  variety: 'shot-type-and-movement-change-v1';
  repeatControl: 'source-scene-repeat-penalty-v1';
}

export interface EditorialBrainPlanningPolicy {
  schemaVersion: typeof EDITORIAL_BRAIN_PLANNING_POLICY_SCHEMA_VERSION;
  policyId: string;
  revisionId: string;
  benchmarkControl: EditorialBrainBenchmarkControl;
  styleProfile: EditorialBrainStyleProfileRef;
  planningMethod: EditorialBrainPlanningMethod;
  candidatePoolSize: number;
  objectives: EditorialBrainPlanningObjectives;
  tieBreak: 'candidate-rank-then-scene-id-v1';
  createdAt: string;
}

export interface EditorialBrainPlanningPolicyValidationResult {
  valid: boolean;
  errors: string[];
}

const MAX_CANDIDATE_POOL_SIZE = 1_000;

function required(value: string): boolean {
  return value.trim().length > 0;
}

export function validateEditorialBrainPlanningPolicy(
  policy: EditorialBrainPlanningPolicy,
): EditorialBrainPlanningPolicyValidationResult {
  const errors: string[] = [];

  if (policy.schemaVersion !== EDITORIAL_BRAIN_PLANNING_POLICY_SCHEMA_VERSION) {
    errors.push('unsupported editorial brain planning policy schemaVersion');
  }
  if (!required(policy.policyId)) errors.push('policyId is required');
  if (!required(policy.revisionId)) errors.push('revisionId is required');

  if (!required(policy.benchmarkControl.benchmarkRevisionId)) {
    errors.push('benchmarkControl.benchmarkRevisionId is required');
  }
  if (!required(policy.benchmarkControl.fixtureRevisionId)) {
    errors.push('benchmarkControl.fixtureRevisionId is required');
  }
  if (!required(policy.benchmarkControl.controlPlanRevisionId)) {
    errors.push('benchmarkControl.controlPlanRevisionId is required');
  }
  if (!required(policy.benchmarkControl.evaluationPolicyRevisionId)) {
    errors.push('benchmarkControl.evaluationPolicyRevisionId is required');
  }

  if (!required(policy.styleProfile.profileId)) {
    errors.push('styleProfile.profileId is required');
  }
  if (!required(policy.styleProfile.profileVersion)) {
    errors.push('styleProfile.profileVersion is required');
  }

  if (policy.planningMethod !== 'deterministic-style-guided-greedy-v1') {
    errors.push('unsupported planningMethod');
  }
  if (
    !Number.isSafeInteger(policy.candidatePoolSize)
    || policy.candidatePoolSize < 1
    || policy.candidatePoolSize > MAX_CANDIDATE_POOL_SIZE
  ) {
    errors.push(`candidatePoolSize must be a safe integer between 1 and ${MAX_CANDIDATE_POOL_SIZE}`);
  }

  if (policy.objectives.pacing !== 'style-duration-fit-v1') {
    errors.push('unsupported pacing objective');
  }
  if (policy.objectives.continuity !== 'adjacent-continuity-group-v1') {
    errors.push('unsupported continuity objective');
  }
  if (policy.objectives.variety !== 'shot-type-and-movement-change-v1') {
    errors.push('unsupported variety objective');
  }
  if (policy.objectives.repeatControl !== 'source-scene-repeat-penalty-v1') {
    errors.push('unsupported repeatControl objective');
  }
  if (policy.tieBreak !== 'candidate-rank-then-scene-id-v1') {
    errors.push('unsupported tieBreak');
  }

  if (Number.isNaN(Date.parse(policy.createdAt))) {
    errors.push('createdAt must be an ISO-compatible timestamp');
  }

  return { valid: errors.length === 0, errors };
}
