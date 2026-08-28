import { AI_EDITOR_STAGES, type AiEditorStage } from './cost-performance-telemetry.contract.js';

export const QUOTA_ADMISSION_POLICY_SCHEMA_VERSION = '1.0' as const;
export const QUOTA_ADMISSION_POLICY_AUTHORITY = 'admission-only' as const;

export interface QuotaAdmissionLimitsV1 {
  maxInFlightJobsPerProject: number;
  maxActiveJobsPerProject: number;
  stageStartWindowSeconds: number;
  maxStageStartsPerProjectPerWindow: number;
  maxEstimatedInputBytesPerAdmission: number;
  maxEstimatedMediaDurationMsPerAdmission: number;
}

export interface QuotaAdmissionPolicyRevisionV1 {
  schemaVersion: typeof QUOTA_ADMISSION_POLICY_SCHEMA_VERSION;
  authority: typeof QUOTA_ADMISSION_POLICY_AUTHORITY;
  policyId: string;
  revisionId: string;
  owner: string;
  stageScope: readonly AiEditorStage[];
  limits: QuotaAdmissionLimitsV1;
  createdAt: string;
}

export interface QuotaAdmissionPolicyValidationResult {
  valid: boolean;
  errors: string[];
}

const MUTABLE_ALIASES = new Set(['latest', 'main', 'master', 'stable', 'default', 'current', 'head']);
const nonEmpty = (value: string): boolean => value.trim().length > 0;
const pinned = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && !MUTABLE_ALIASES.has(normalized);
};
const positiveSafeInteger = (value: number): boolean => Number.isSafeInteger(value) && value > 0;

export function validateQuotaAdmissionPolicyRevisionV1(
  policy: QuotaAdmissionPolicyRevisionV1,
): QuotaAdmissionPolicyValidationResult {
  const errors: string[] = [];

  if (policy.schemaVersion !== QUOTA_ADMISSION_POLICY_SCHEMA_VERSION) errors.push('schemaVersion must be 1.0');
  if (policy.authority !== QUOTA_ADMISSION_POLICY_AUTHORITY) errors.push('authority must be admission-only');
  if (!nonEmpty(policy.policyId)) errors.push('policyId is required');
  if (!pinned(policy.revisionId)) errors.push('revisionId must be pinned and must not use a mutable alias');
  if (!nonEmpty(policy.owner)) errors.push('owner is required');
  if (!Number.isFinite(Date.parse(policy.createdAt))) errors.push('createdAt must be a valid timestamp');

  if (policy.stageScope.length === 0) errors.push('stageScope must not be empty');
  const stageSet = new Set<AiEditorStage>();
  policy.stageScope.forEach((stage, index) => {
    if (!AI_EDITOR_STAGES.includes(stage)) errors.push(`stageScope[${index}] is unsupported`);
    else if (stageSet.has(stage)) errors.push(`stageScope[${index}] must be unique`);
    else stageSet.add(stage);
  });

  for (const [key, value] of Object.entries(policy.limits)) {
    if (!positiveSafeInteger(value)) errors.push(`limits.${key} must be a positive safe integer`);
  }
  if (policy.limits.maxActiveJobsPerProject > policy.limits.maxInFlightJobsPerProject) {
    errors.push('limits.maxActiveJobsPerProject cannot exceed maxInFlightJobsPerProject');
  }

  return { valid: errors.length === 0, errors };
}
