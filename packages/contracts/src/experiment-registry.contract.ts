export const EXPERIMENT_REGISTRY_SCHEMA_VERSION = '1.0' as const;

export interface ExperimentBenchmarkControlRefV1 {
  benchmarkId: string;
  benchmarkRevisionId: string;
  controlRevisionId: string;
  fixtureRevisionId?: string;
}

export interface ExperimentCandidatePolicyRefV1 {
  policyId: string;
  policyRevisionId: string;
}

export interface ExperimentModelRefV1 {
  modelId: string;
  modelVersion: string;
}

export interface ExperimentPromptRefV1 {
  promptId: string;
  promptVersion: string;
}

export interface ExperimentExecutionProfileRefV1 {
  profileId: string;
  profileVersion: string;
}

export interface ExperimentEvaluationResultRefV1 {
  evaluationPolicyId: string;
  evaluationPolicyVersion: string;
  resultId: string;
  resultRevisionId: string;
  resultArtifactId: string;
  resultSha256: string;
}

export interface ExperimentRegistryRevisionV1 {
  schemaVersion: typeof EXPERIMENT_REGISTRY_SCHEMA_VERSION;
  experimentId: string;
  revisionId: string;
  benchmarkControl: ExperimentBenchmarkControlRefV1;
  candidate: {
    policy: ExperimentCandidatePolicyRefV1;
    model: ExperimentModelRefV1;
    prompt?: ExperimentPromptRefV1;
    executionProfile: ExperimentExecutionProfileRefV1;
  };
  evaluation: ExperimentEvaluationResultRefV1;
  startedAt: string;
  completedAt: string;
  createdAt: string;
}

export interface ExperimentRegistryValidationResult {
  valid: boolean;
  errors: string[];
}

const SHA256 = /^[a-f0-9]{64}$/i;
const MUTABLE_ALIASES = new Set(['latest', 'main', 'master', 'stable', 'default', 'current', 'head']);
const nonEmpty = (value: string): boolean => value.trim().length > 0;
const validTimestamp = (value: string): boolean => Number.isFinite(Date.parse(value));
const pinned = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && !MUTABLE_ALIASES.has(normalized);
};

function requirePinned(errors: string[], value: string, field: string): void {
  if (!pinned(value)) errors.push(`${field} must be pinned and must not use a mutable alias`);
}

export function validateExperimentRegistryRevisionV1(
  revision: ExperimentRegistryRevisionV1,
): ExperimentRegistryValidationResult {
  const errors: string[] = [];

  if (revision.schemaVersion !== EXPERIMENT_REGISTRY_SCHEMA_VERSION) {
    errors.push('schemaVersion must be 1.0');
  }
  if (!nonEmpty(revision.experimentId)) errors.push('experimentId is required');
  requirePinned(errors, revision.revisionId, 'revisionId');

  if (!nonEmpty(revision.benchmarkControl.benchmarkId)) errors.push('benchmarkControl.benchmarkId is required');
  requirePinned(errors, revision.benchmarkControl.benchmarkRevisionId, 'benchmarkControl.benchmarkRevisionId');
  requirePinned(errors, revision.benchmarkControl.controlRevisionId, 'benchmarkControl.controlRevisionId');
  if (revision.benchmarkControl.fixtureRevisionId !== undefined) {
    requirePinned(errors, revision.benchmarkControl.fixtureRevisionId, 'benchmarkControl.fixtureRevisionId');
  }

  if (!nonEmpty(revision.candidate.policy.policyId)) errors.push('candidate.policy.policyId is required');
  requirePinned(errors, revision.candidate.policy.policyRevisionId, 'candidate.policy.policyRevisionId');
  if (!nonEmpty(revision.candidate.model.modelId)) errors.push('candidate.model.modelId is required');
  requirePinned(errors, revision.candidate.model.modelVersion, 'candidate.model.modelVersion');
  if (revision.candidate.prompt !== undefined) {
    if (!nonEmpty(revision.candidate.prompt.promptId)) errors.push('candidate.prompt.promptId is required');
    requirePinned(errors, revision.candidate.prompt.promptVersion, 'candidate.prompt.promptVersion');
  }
  if (!nonEmpty(revision.candidate.executionProfile.profileId)) {
    errors.push('candidate.executionProfile.profileId is required');
  }
  requirePinned(errors, revision.candidate.executionProfile.profileVersion, 'candidate.executionProfile.profileVersion');

  if (!nonEmpty(revision.evaluation.evaluationPolicyId)) errors.push('evaluation.evaluationPolicyId is required');
  requirePinned(errors, revision.evaluation.evaluationPolicyVersion, 'evaluation.evaluationPolicyVersion');
  if (!nonEmpty(revision.evaluation.resultId)) errors.push('evaluation.resultId is required');
  requirePinned(errors, revision.evaluation.resultRevisionId, 'evaluation.resultRevisionId');
  if (!nonEmpty(revision.evaluation.resultArtifactId)) errors.push('evaluation.resultArtifactId is required');
  if (!SHA256.test(revision.evaluation.resultSha256)) errors.push('evaluation.resultSha256 must be a SHA-256 hex digest');

  if (!validTimestamp(revision.startedAt)) errors.push('startedAt must be a valid timestamp');
  if (!validTimestamp(revision.completedAt)) errors.push('completedAt must be a valid timestamp');
  if (!validTimestamp(revision.createdAt)) errors.push('createdAt must be a valid timestamp');
  if (validTimestamp(revision.startedAt) && validTimestamp(revision.completedAt)) {
    if (Date.parse(revision.completedAt) < Date.parse(revision.startedAt)) {
      errors.push('completedAt must not be earlier than startedAt');
    }
  }

  return { valid: errors.length === 0, errors };
}
