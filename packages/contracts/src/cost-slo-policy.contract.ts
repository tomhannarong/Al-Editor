import { AI_EDITOR_STAGES, type AiEditorStage } from './cost-performance-telemetry.contract.js';

export const COST_SLO_POLICY_SCHEMA_VERSION = '1.0' as const;
export const COST_SLO_POLICY_AUTHORITY = 'evaluation-only' as const;

export interface CostSloLimitsV1 {
  evaluationWindowSeconds: number;
  minObservedStageRuns: number;
  maxTotalCostMicrosPerProjectWindow: number;
  maxP95WallDurationMs: number;
  maxFailureRateBasisPoints: number;
}

export interface CostSloPolicyRevisionV1 {
  schemaVersion: typeof COST_SLO_POLICY_SCHEMA_VERSION;
  authority: typeof COST_SLO_POLICY_AUTHORITY;
  policyId: string;
  revisionId: string;
  owner: string;
  stageScope: readonly AiEditorStage[];
  currency: string;
  requireCostEvidence: boolean;
  limits: CostSloLimitsV1;
  createdAt: string;
}

export interface CostSloPolicyValidationResult {
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
const nonNegativeSafeInteger = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;

export function validateCostSloPolicyRevisionV1(
  policy: CostSloPolicyRevisionV1,
): CostSloPolicyValidationResult {
  const errors: string[] = [];

  if (policy.schemaVersion !== COST_SLO_POLICY_SCHEMA_VERSION) errors.push('schemaVersion must be 1.0');
  if (policy.authority !== COST_SLO_POLICY_AUTHORITY) errors.push('authority must be evaluation-only');
  if (!nonEmpty(policy.policyId)) errors.push('policyId is required');
  if (!pinned(policy.revisionId)) errors.push('revisionId must be pinned and must not use a mutable alias');
  if (!nonEmpty(policy.owner)) errors.push('owner is required');
  if (!Number.isFinite(Date.parse(policy.createdAt))) errors.push('createdAt must be a valid timestamp');
  if (!/^[A-Z]{3}$/.test(policy.currency)) errors.push('currency must be an uppercase ISO-style code');

  if (policy.stageScope.length === 0) errors.push('stageScope must not be empty');
  const stageSet = new Set<AiEditorStage>();
  policy.stageScope.forEach((stage, index) => {
    if (!AI_EDITOR_STAGES.includes(stage)) errors.push(`stageScope[${index}] is unsupported`);
    else if (stageSet.has(stage)) errors.push(`stageScope[${index}] must be unique`);
    else stageSet.add(stage);
  });

  if (!positiveSafeInteger(policy.limits.evaluationWindowSeconds)) errors.push('limits.evaluationWindowSeconds must be a positive safe integer');
  if (!positiveSafeInteger(policy.limits.minObservedStageRuns)) errors.push('limits.minObservedStageRuns must be a positive safe integer');
  if (!nonNegativeSafeInteger(policy.limits.maxTotalCostMicrosPerProjectWindow)) errors.push('limits.maxTotalCostMicrosPerProjectWindow must be a non-negative safe integer');
  if (!nonNegativeSafeInteger(policy.limits.maxP95WallDurationMs)) errors.push('limits.maxP95WallDurationMs must be a non-negative safe integer');
  if (!nonNegativeSafeInteger(policy.limits.maxFailureRateBasisPoints) || policy.limits.maxFailureRateBasisPoints > 10_000) {
    errors.push('limits.maxFailureRateBasisPoints must be a safe integer from 0 to 10000');
  }

  return { valid: errors.length === 0, errors };
}
