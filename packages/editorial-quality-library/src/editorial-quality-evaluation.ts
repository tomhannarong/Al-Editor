import {
  validateEditorialStyleProfileV1,
  type EditorialStyleProfileV1,
} from '../../contracts/src/editorial-style-profile.contract.js';

export const EDITORIAL_QUALITY_EVALUATION_SCHEMA_VERSION = '1.0' as const;
export const EDITORIAL_QUALITY_EVALUATION_POLICY_REVISION =
  'editorial-quality-evaluation-policy:v1' as const;

export interface EditorialPlanFrameRate {
  numerator: number;
  denominator: number;
}

export interface EditorialPlanShotEvidenceV1 {
  shotId: string;
  sourceSceneId: string;
  shotType: string;
  movementType: string;
  continuityGroupId: string;
  startFrame: number;
  endFrame: number;
}

/**
 * Immutable plan evidence consumed by the Phase-8 evaluator.
 *
 * Project timing stays authoritative as integer frames + rational FPS. Style
 * profile millisecond preferences are never copied into this evidence.
 */
export interface EditorialPlanEvidenceV1 {
  schemaVersion: typeof EDITORIAL_QUALITY_EVALUATION_SCHEMA_VERSION;
  fixtureRevisionId: string;
  planId: string;
  revisionId: string;
  styleProfileId: string;
  styleProfileVersion: string;
  frameRate: EditorialPlanFrameRate;
  shots: EditorialPlanShotEvidenceV1[];
}

export interface EditorialQualityMeasurementV1 {
  schemaVersion: typeof EDITORIAL_QUALITY_EVALUATION_SCHEMA_VERSION;
  evaluationPolicyRevision: typeof EDITORIAL_QUALITY_EVALUATION_POLICY_REVISION;
  fixtureRevisionId: string;
  planId: string;
  planRevisionId: string;
  styleProfileId: string;
  styleProfileVersion: string;
  shotCount: number;
  pacingScore: number;
  pacingWithinBoundsRate: number;
  continuityScore: number;
  varietyScore: number;
  shotTypeChangeRate: number;
  movementChangeRate: number;
  repeatRate: number;
  repeatedShotCount: number;
}

export interface EditorialQualityComparisonV1 {
  schemaVersion: typeof EDITORIAL_QUALITY_EVALUATION_SCHEMA_VERSION;
  evaluationPolicyRevision: typeof EDITORIAL_QUALITY_EVALUATION_POLICY_REVISION;
  fixtureRevisionId: string;
  beforePlanRevisionId: string;
  afterPlanRevisionId: string;
  pacingDelta: number;
  continuityDelta: number;
  varietyDelta: number;
  repeatRateDelta: number;
  pacingImproved: boolean;
  continuityImproved: boolean;
  varietyImproved: boolean;
  repeatRateLowered: boolean;
}

export class EditorialQualityEvaluationInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EditorialQualityEvaluationInvariantError';
  }
}

/**
 * Deterministic Phase-8 editorial-quality evaluator.
 *
 * v1 semantics:
 * - pacing: mean of per-shot duration-within-bounds and target-closeness scores;
 *   the first shot uses hookShotDurationMs and later shots use targetShotDurationMs;
 * - continuity: fraction of adjacent shots sharing continuityGroupId;
 * - variety: mean of adjacent shot-type-change and movement-change rates;
 * - repeat rate: fraction of shots whose sourceSceneId appeared earlier in the plan.
 *
 * Milliseconds are derived transiently from canonical project frames only to
 * compare against Style Profile planner preferences. They are not returned or
 * persisted as timing authority.
 */
export function measureEditorialQualityV1(
  plan: EditorialPlanEvidenceV1,
  styleProfile: EditorialStyleProfileV1,
): EditorialQualityMeasurementV1 {
  validatePlan(plan);
  validateStyleBinding(plan, styleProfile);

  const durationScores = plan.shots.map((shot, index) => {
    const durationMs = framesToDerivedMilliseconds(
      shot.endFrame - shot.startFrame,
      plan.frameRate,
    );
    const withinBounds =
      durationMs >= styleProfile.duration.minShotDurationMs &&
      durationMs <= styleProfile.duration.maxShotDurationMs;
    const targetMs =
      index === 0
        ? styleProfile.duration.hookShotDurationMs
        : styleProfile.duration.targetShotDurationMs;
    const normalizationSpan = Math.max(
      targetMs - styleProfile.duration.minShotDurationMs,
      styleProfile.duration.maxShotDurationMs - targetMs,
      1,
    );
    const closeness = clampUnit(1 - Math.abs(durationMs - targetMs) / normalizationSpan);
    return { withinBounds: withinBounds ? 1 : 0, closeness };
  });

  const pacingWithinBoundsRate = mean(durationScores.map((score) => score.withinBounds));
  const pacingTargetCloseness = mean(durationScores.map((score) => score.closeness));
  const pacingScore = (pacingWithinBoundsRate + pacingTargetCloseness) / 2;

  const adjacencyCount = Math.max(plan.shots.length - 1, 0);
  let continuityMatches = 0;
  let shotTypeChanges = 0;
  let movementChanges = 0;
  for (let index = 1; index < plan.shots.length; index += 1) {
    const previous = plan.shots[index - 1];
    const current = plan.shots[index];
    if (previous === undefined || current === undefined) {
      throw new EditorialQualityEvaluationInvariantError('shot ordering became inconsistent');
    }
    if (previous.continuityGroupId === current.continuityGroupId) continuityMatches += 1;
    if (previous.shotType !== current.shotType) shotTypeChanges += 1;
    if (previous.movementType !== current.movementType) movementChanges += 1;
  }

  const continuityScore = adjacencyCount === 0 ? 1 : continuityMatches / adjacencyCount;
  const shotTypeChangeRate = adjacencyCount === 0 ? 1 : shotTypeChanges / adjacencyCount;
  const movementChangeRate = adjacencyCount === 0 ? 1 : movementChanges / adjacencyCount;
  const varietyScore = (shotTypeChangeRate + movementChangeRate) / 2;

  const seenSourceScenes = new Set<string>();
  let repeatedShotCount = 0;
  for (const shot of plan.shots) {
    if (seenSourceScenes.has(shot.sourceSceneId)) repeatedShotCount += 1;
    seenSourceScenes.add(shot.sourceSceneId);
  }

  return {
    schemaVersion: EDITORIAL_QUALITY_EVALUATION_SCHEMA_VERSION,
    evaluationPolicyRevision: EDITORIAL_QUALITY_EVALUATION_POLICY_REVISION,
    fixtureRevisionId: plan.fixtureRevisionId,
    planId: plan.planId,
    planRevisionId: plan.revisionId,
    styleProfileId: plan.styleProfileId,
    styleProfileVersion: plan.styleProfileVersion,
    shotCount: plan.shots.length,
    pacingScore,
    pacingWithinBoundsRate,
    continuityScore,
    varietyScore,
    shotTypeChangeRate,
    movementChangeRate,
    repeatRate: repeatedShotCount / plan.shots.length,
    repeatedShotCount,
  };
}

/** Compare two measurements only when they came from the exact same benchmark fixture/style authority. */
export function compareEditorialQualityV1(
  before: EditorialQualityMeasurementV1,
  after: EditorialQualityMeasurementV1,
): EditorialQualityComparisonV1 {
  validateComparableMeasurements(before, after);
  return {
    schemaVersion: EDITORIAL_QUALITY_EVALUATION_SCHEMA_VERSION,
    evaluationPolicyRevision: EDITORIAL_QUALITY_EVALUATION_POLICY_REVISION,
    fixtureRevisionId: before.fixtureRevisionId,
    beforePlanRevisionId: before.planRevisionId,
    afterPlanRevisionId: after.planRevisionId,
    pacingDelta: after.pacingScore - before.pacingScore,
    continuityDelta: after.continuityScore - before.continuityScore,
    varietyDelta: after.varietyScore - before.varietyScore,
    repeatRateDelta: after.repeatRate - before.repeatRate,
    pacingImproved: after.pacingScore > before.pacingScore,
    continuityImproved: after.continuityScore > before.continuityScore,
    varietyImproved: after.varietyScore > before.varietyScore,
    repeatRateLowered: after.repeatRate < before.repeatRate,
  };
}

function validatePlan(plan: EditorialPlanEvidenceV1): void {
  if (plan.schemaVersion !== EDITORIAL_QUALITY_EVALUATION_SCHEMA_VERSION) {
    throw new EditorialQualityEvaluationInvariantError('unsupported plan evidence schemaVersion');
  }
  for (const [label, value] of [
    ['fixtureRevisionId', plan.fixtureRevisionId],
    ['planId', plan.planId],
    ['revisionId', plan.revisionId],
    ['styleProfileId', plan.styleProfileId],
    ['styleProfileVersion', plan.styleProfileVersion],
  ] as const) {
    if (!value.trim()) throw new EditorialQualityEvaluationInvariantError(`${label} is required`);
  }
  if (
    !Number.isSafeInteger(plan.frameRate.numerator) ||
    plan.frameRate.numerator <= 0 ||
    !Number.isSafeInteger(plan.frameRate.denominator) ||
    plan.frameRate.denominator <= 0
  ) {
    throw new EditorialQualityEvaluationInvariantError(
      'frameRate numerator and denominator must be positive safe integers',
    );
  }
  if (plan.shots.length === 0) {
    throw new EditorialQualityEvaluationInvariantError('plan requires at least one shot');
  }

  const shotIds = new Set<string>();
  let previousEndFrame = -1;
  for (const shot of plan.shots) {
    if (
      !shot.shotId.trim() ||
      !shot.sourceSceneId.trim() ||
      !shot.shotType.trim() ||
      !shot.movementType.trim() ||
      !shot.continuityGroupId.trim()
    ) {
      throw new EditorialQualityEvaluationInvariantError('shot identity and editorial labels are required');
    }
    if (shotIds.has(shot.shotId)) {
      throw new EditorialQualityEvaluationInvariantError(`duplicate shotId ${shot.shotId}`);
    }
    shotIds.add(shot.shotId);
    if (
      !Number.isSafeInteger(shot.startFrame) ||
      !Number.isSafeInteger(shot.endFrame) ||
      shot.startFrame < 0 ||
      shot.endFrame <= shot.startFrame
    ) {
      throw new EditorialQualityEvaluationInvariantError(
        `shot ${shot.shotId} requires a positive integer project-frame interval`,
      );
    }
    if (shot.startFrame < previousEndFrame) {
      throw new EditorialQualityEvaluationInvariantError('shots must be ordered and non-overlapping');
    }
    previousEndFrame = shot.endFrame;
  }
}

function validateStyleBinding(
  plan: EditorialPlanEvidenceV1,
  styleProfile: EditorialStyleProfileV1,
): void {
  const validation = validateEditorialStyleProfileV1(styleProfile);
  if (!validation.valid) {
    throw new EditorialQualityEvaluationInvariantError(
      `invalid style profile: ${validation.errors.join('; ')}`,
    );
  }
  if (
    plan.styleProfileId !== styleProfile.profileId ||
    plan.styleProfileVersion !== styleProfile.profileVersion
  ) {
    throw new EditorialQualityEvaluationInvariantError(
      'plan style-profile identity/version does not match evaluation authority',
    );
  }
}

function validateComparableMeasurements(
  before: EditorialQualityMeasurementV1,
  after: EditorialQualityMeasurementV1,
): void {
  for (const measurement of [before, after]) {
    if (
      measurement.schemaVersion !== EDITORIAL_QUALITY_EVALUATION_SCHEMA_VERSION ||
      measurement.evaluationPolicyRevision !== EDITORIAL_QUALITY_EVALUATION_POLICY_REVISION
    ) {
      throw new EditorialQualityEvaluationInvariantError(
        'measurements must use the supported versioned evaluation policy',
      );
    }
  }
  if (before.fixtureRevisionId !== after.fixtureRevisionId) {
    throw new EditorialQualityEvaluationInvariantError(
      'before/after measurements must use the exact same fixture revision',
    );
  }
  if (
    before.styleProfileId !== after.styleProfileId ||
    before.styleProfileVersion !== after.styleProfileVersion
  ) {
    throw new EditorialQualityEvaluationInvariantError(
      'before/after measurements must use the exact same style-profile authority',
    );
  }
  if (before.planRevisionId === after.planRevisionId) {
    throw new EditorialQualityEvaluationInvariantError(
      'before/after comparison requires distinct immutable plan revisions',
    );
  }
}

function framesToDerivedMilliseconds(
  frames: number,
  frameRate: EditorialPlanFrameRate,
): number {
  return (frames * frameRate.denominator * 1000) / frameRate.numerator;
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
