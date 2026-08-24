export const EDITORIAL_STYLE_PROFILE_SCHEMA_VERSION = '1.0' as const;
export type EditorialStyleProfileStatus = 'draft' | 'approved' | 'archived';
export interface EditorialStyleAuthorityDocumentRef { documentId: string; version: string; }
/** Reference Brand authority; this profile does not duplicate Brand DNA copy/tone/visual identity. */
export interface EditorialStyleBrandAuthorityRef { brandId: string; brandVersion: string; videoStyleDnaDocument: EditorialStyleAuthorityDocumentRef; }
export interface EditorialStyleDurationPolicy { targetShotDurationMs: number; hookShotDurationMs: number; minShotDurationMs: number; maxShotDurationMs: number; }
export interface EditorialStyleVarietyPolicy { maxConsecutiveSameShotType: number; preferredHumanPresenceIntervalMs: number | null; penalizeNearDuplicates: boolean; }
export interface EditorialStyleMovementPolicy { movementPreferenceWeight: number; repeatedMovementPenaltyWeight: number; }
export interface EditorialStyleTransitionPolicy { hardCutWeight: number; maxNonCutTransitionRatio: number; }
export interface EditorialStyleScoringWeights { semanticRelevance: number; visualQuality: number; continuity: number; variety: number; novelty: number; }
/** Planner policy only. Millisecond preferences never become canonical timeline timing authority. */
export interface EditorialStyleProfileV1 { schemaVersion: typeof EDITORIAL_STYLE_PROFILE_SCHEMA_VERSION; profileId: string; profileVersion: string; status: EditorialStyleProfileStatus; brandAuthority: EditorialStyleBrandAuthorityRef; duration: EditorialStyleDurationPolicy; variety: EditorialStyleVarietyPolicy; movement: EditorialStyleMovementPolicy; transitions: EditorialStyleTransitionPolicy; scoring: EditorialStyleScoringWeights; createdAt: string; updatedAt: string; }
export interface EditorialStyleProfileValidationResult { valid: boolean; errors: string[]; }
const positiveSafeInteger = (value: number): boolean => Number.isSafeInteger(value) && value > 0;
const unitInterval = (value: number): boolean => Number.isFinite(value) && value >= 0 && value <= 1;
const nonNegativeFinite = (value: number): boolean => Number.isFinite(value) && value >= 0;
const validDate = (value: string): boolean => value.trim().length > 0 && !Number.isNaN(Date.parse(value));
export function validateEditorialStyleProfileV1(profile: EditorialStyleProfileV1): EditorialStyleProfileValidationResult {
  const errors: string[] = [];
  if (profile.schemaVersion !== EDITORIAL_STYLE_PROFILE_SCHEMA_VERSION) errors.push('schemaVersion must be 1.0');
  if (!profile.profileId.trim() || !profile.profileVersion.trim()) errors.push('profileId and profileVersion are required');
  if (!profile.brandAuthority.brandId.trim() || !profile.brandAuthority.brandVersion.trim()) errors.push('brandAuthority must reference a brandId and brandVersion');
  if (!profile.brandAuthority.videoStyleDnaDocument.documentId.trim() || !profile.brandAuthority.videoStyleDnaDocument.version.trim()) errors.push('brandAuthority must reference the VIDEO-STYLE-DNA document id and version');
  const duration = profile.duration;
  if (![duration.targetShotDurationMs, duration.hookShotDurationMs, duration.minShotDurationMs, duration.maxShotDurationMs].every(positiveSafeInteger)) errors.push('duration values must be positive safe integers in milliseconds');
  if (duration.minShotDurationMs > duration.maxShotDurationMs) errors.push('minShotDurationMs must be <= maxShotDurationMs');
  if (duration.targetShotDurationMs < duration.minShotDurationMs || duration.targetShotDurationMs > duration.maxShotDurationMs) errors.push('targetShotDurationMs must be within the configured duration bounds');
  if (duration.hookShotDurationMs < duration.minShotDurationMs || duration.hookShotDurationMs > duration.maxShotDurationMs) errors.push('hookShotDurationMs must be within the configured duration bounds');
  if (!positiveSafeInteger(profile.variety.maxConsecutiveSameShotType)) errors.push('maxConsecutiveSameShotType must be a positive safe integer');
  if (profile.variety.preferredHumanPresenceIntervalMs !== null && !positiveSafeInteger(profile.variety.preferredHumanPresenceIntervalMs)) errors.push('preferredHumanPresenceIntervalMs must be null or a positive safe integer');
  if (!unitInterval(profile.movement.movementPreferenceWeight)) errors.push('movementPreferenceWeight must be between 0 and 1');
  if (!unitInterval(profile.movement.repeatedMovementPenaltyWeight)) errors.push('repeatedMovementPenaltyWeight must be between 0 and 1');
  if (!unitInterval(profile.transitions.hardCutWeight)) errors.push('hardCutWeight must be between 0 and 1');
  if (!unitInterval(profile.transitions.maxNonCutTransitionRatio)) errors.push('maxNonCutTransitionRatio must be between 0 and 1');
  const scoringValues = Object.values(profile.scoring);
  if (!scoringValues.every(nonNegativeFinite)) errors.push('scoring weights must be finite and non-negative');
  if (scoringValues.reduce((sum, value) => sum + value, 0) <= 0) errors.push('at least one scoring weight must be positive');
  if (!validDate(profile.createdAt) || !validDate(profile.updatedAt)) errors.push('createdAt and updatedAt must be valid date-time strings');
  if (validDate(profile.createdAt) && validDate(profile.updatedAt) && Date.parse(profile.updatedAt) < Date.parse(profile.createdAt)) errors.push('updatedAt must be >= createdAt');
  return { valid: errors.length === 0, errors };
}
