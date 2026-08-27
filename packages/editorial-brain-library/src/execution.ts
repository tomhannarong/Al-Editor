import {
  validateEditorialBrainPlanningPolicy,
  type EditorialBrainPlanningPolicy,
} from '../../contracts/src/editorial-brain-planning-policy.contract.js';
import {
  validateEditorialStyleProfileV1,
  type EditorialStyleProfileV1,
} from '../../contracts/src/editorial-style-profile.contract.js';
import type {
  EditorialPlanEvidenceV1,
  EditorialPlanFrameRate,
  EditorialPlanShotEvidenceV1,
} from '../../editorial-quality-library/src/editorial-quality-evaluation.js';

export const EDITORIAL_BRAIN_EXECUTION_SCHEMA_VERSION = '1.0' as const;

export interface EditorialBrainCandidateEvidenceV1 {
  candidateId: string;
  candidateRank: number;
  sourceSceneId: string;
  shotType: string;
  movementType: string;
  continuityGroupId: string;
  durationFrames: number;
}

export interface EditorialBrainPlanningSlotV1 {
  slotId: string;
  candidates: EditorialBrainCandidateEvidenceV1[];
}

export interface EditorialBrainPlanningExecutionRequestV1 {
  schemaVersion: typeof EDITORIAL_BRAIN_EXECUTION_SCHEMA_VERSION;
  fixtureRevisionId: string;
  planId: string;
  revisionId: string;
  frameRate: EditorialPlanFrameRate;
  slots: EditorialBrainPlanningSlotV1[];
}

export class EditorialBrainExecutionInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EditorialBrainExecutionInvariantError';
  }
}

/**
 * Deterministic Style-Profile-guided planner for Phase 8.
 *
 * Retrieval relevance is already reflected by candidateRank and is not
 * rescored here. The planner applies only editorial objectives from the pinned
 * planning policy: avoid repeated source scenes, preserve adjacent continuity,
 * prefer shot/movement variety, then prefer Style Profile duration fit. Exact
 * ties use candidate rank and scene ID as required by the policy.
 *
 * Output timing remains integer project frames + rational FPS. Style Profile
 * millisecond preferences are used only as comparison constants and are never
 * persisted into the resulting plan.
 */
export function executeEditorialBrainPlanningV1(
  request: EditorialBrainPlanningExecutionRequestV1,
  policy: EditorialBrainPlanningPolicy,
  styleProfile: EditorialStyleProfileV1,
): EditorialPlanEvidenceV1 {
  validateExecutionAuthority(request, policy, styleProfile);

  const selected: EditorialBrainCandidateEvidenceV1[] = [];
  const seenSourceScenes = new Set<string>();
  let previous: EditorialBrainCandidateEvidenceV1 | undefined;

  for (let slotIndex = 0; slotIndex < request.slots.length; slotIndex += 1) {
    const slot = request.slots[slotIndex];
    if (slot === undefined) {
      throw new EditorialBrainExecutionInvariantError('planning slot ordering became inconsistent');
    }

    const targetDurationMs =
      slotIndex === 0
        ? styleProfile.duration.hookShotDurationMs
        : styleProfile.duration.targetShotDurationMs;

    const ranked = [...slot.candidates].sort((left, right) =>
      compareCandidates(
        left,
        right,
        previous,
        seenSourceScenes,
        targetDurationMs,
        request.frameRate,
      ),
    );
    const winner = ranked[0];
    if (winner === undefined) {
      throw new EditorialBrainExecutionInvariantError(`slot ${slot.slotId} has no candidates`);
    }

    selected.push(winner);
    seenSourceScenes.add(winner.sourceSceneId);
    previous = winner;
  }

  let frameCursor = 0;
  const shots: EditorialPlanShotEvidenceV1[] = selected.map((candidate, index) => {
    const startFrame = frameCursor;
    const endFrame = startFrame + candidate.durationFrames;
    frameCursor = endFrame;
    return {
      shotId: `${request.revisionId}:shot:${index + 1}`,
      sourceSceneId: candidate.sourceSceneId,
      shotType: candidate.shotType,
      movementType: candidate.movementType,
      continuityGroupId: candidate.continuityGroupId,
      startFrame,
      endFrame,
    };
  });

  return {
    schemaVersion: EDITORIAL_BRAIN_EXECUTION_SCHEMA_VERSION,
    fixtureRevisionId: request.fixtureRevisionId,
    planId: request.planId,
    revisionId: request.revisionId,
    styleProfileId: styleProfile.profileId,
    styleProfileVersion: styleProfile.profileVersion,
    frameRate: { ...request.frameRate },
    shots,
  };
}

function validateExecutionAuthority(
  request: EditorialBrainPlanningExecutionRequestV1,
  policy: EditorialBrainPlanningPolicy,
  styleProfile: EditorialStyleProfileV1,
): void {
  if (request.schemaVersion !== EDITORIAL_BRAIN_EXECUTION_SCHEMA_VERSION) {
    throw new EditorialBrainExecutionInvariantError('unsupported execution schemaVersion');
  }
  const policyValidation = validateEditorialBrainPlanningPolicy(policy);
  if (!policyValidation.valid) {
    throw new EditorialBrainExecutionInvariantError(
      `invalid planning policy: ${policyValidation.errors.join('; ')}`,
    );
  }
  const styleValidation = validateEditorialStyleProfileV1(styleProfile);
  if (!styleValidation.valid) {
    throw new EditorialBrainExecutionInvariantError(
      `invalid style profile: ${styleValidation.errors.join('; ')}`,
    );
  }
  if (
    policy.styleProfile.profileId !== styleProfile.profileId ||
    policy.styleProfile.profileVersion !== styleProfile.profileVersion
  ) {
    throw new EditorialBrainExecutionInvariantError(
      'planning policy does not bind the supplied Style Profile authority',
    );
  }
  if (request.fixtureRevisionId !== policy.benchmarkControl.fixtureRevisionId) {
    throw new EditorialBrainExecutionInvariantError(
      'execution fixture must match the policy benchmark-control fixture',
    );
  }
  if (request.revisionId === policy.benchmarkControl.controlPlanRevisionId) {
    throw new EditorialBrainExecutionInvariantError(
      'after-plan revision must be distinct from the frozen control revision',
    );
  }
  for (const [label, value] of [
    ['fixtureRevisionId', request.fixtureRevisionId],
    ['planId', request.planId],
    ['revisionId', request.revisionId],
  ] as const) {
    if (!value.trim()) throw new EditorialBrainExecutionInvariantError(`${label} is required`);
  }
  if (
    !Number.isSafeInteger(request.frameRate.numerator) ||
    request.frameRate.numerator <= 0 ||
    !Number.isSafeInteger(request.frameRate.denominator) ||
    request.frameRate.denominator <= 0
  ) {
    throw new EditorialBrainExecutionInvariantError(
      'frameRate numerator and denominator must be positive safe integers',
    );
  }
  if (request.slots.length === 0) {
    throw new EditorialBrainExecutionInvariantError('execution requires at least one planning slot');
  }

  const slotIds = new Set<string>();
  const candidateIds = new Set<string>();
  let totalCandidates = 0;
  for (const slot of request.slots) {
    if (!slot.slotId.trim()) throw new EditorialBrainExecutionInvariantError('slotId is required');
    if (slotIds.has(slot.slotId)) {
      throw new EditorialBrainExecutionInvariantError(`duplicate slotId ${slot.slotId}`);
    }
    slotIds.add(slot.slotId);
    if (slot.candidates.length === 0) {
      throw new EditorialBrainExecutionInvariantError(`slot ${slot.slotId} requires candidates`);
    }
    const ranks = new Set<number>();
    for (const candidate of slot.candidates) {
      totalCandidates += 1;
      if (
        !candidate.candidateId.trim() ||
        !candidate.sourceSceneId.trim() ||
        !candidate.shotType.trim() ||
        !candidate.movementType.trim() ||
        !candidate.continuityGroupId.trim()
      ) {
        throw new EditorialBrainExecutionInvariantError(
          'candidate identity and editorial labels are required',
        );
      }
      if (candidateIds.has(candidate.candidateId)) {
        throw new EditorialBrainExecutionInvariantError(
          `duplicate candidateId ${candidate.candidateId}`,
        );
      }
      candidateIds.add(candidate.candidateId);
      if (!Number.isSafeInteger(candidate.candidateRank) || candidate.candidateRank < 1) {
        throw new EditorialBrainExecutionInvariantError('candidateRank must be a positive safe integer');
      }
      if (ranks.has(candidate.candidateRank)) {
        throw new EditorialBrainExecutionInvariantError(
          `slot ${slot.slotId} contains duplicate candidateRank ${candidate.candidateRank}`,
        );
      }
      ranks.add(candidate.candidateRank);
      if (!Number.isSafeInteger(candidate.durationFrames) || candidate.durationFrames <= 0) {
        throw new EditorialBrainExecutionInvariantError(
          'candidate durationFrames must be a positive safe integer',
        );
      }
    }
  }
  if (totalCandidates > policy.candidatePoolSize) {
    throw new EditorialBrainExecutionInvariantError(
      `candidate evidence exceeds bounded policy pool ${policy.candidatePoolSize}`,
    );
  }
}

function compareCandidates(
  left: EditorialBrainCandidateEvidenceV1,
  right: EditorialBrainCandidateEvidenceV1,
  previous: EditorialBrainCandidateEvidenceV1 | undefined,
  seenSourceScenes: ReadonlySet<string>,
  targetDurationMs: number,
  frameRate: EditorialPlanFrameRate,
): number {
  const leftTuple = editorialTuple(left, previous, seenSourceScenes, targetDurationMs, frameRate);
  const rightTuple = editorialTuple(right, previous, seenSourceScenes, targetDurationMs, frameRate);

  for (let index = 0; index < leftTuple.length; index += 1) {
    const leftValue = leftTuple[index];
    const rightValue = rightTuple[index];
    if (leftValue === undefined || rightValue === undefined) {
      throw new EditorialBrainExecutionInvariantError('candidate score tuple became inconsistent');
    }
    if (typeof leftValue === 'bigint' && typeof rightValue === 'bigint') {
      if (leftValue < rightValue) return -1;
      if (leftValue > rightValue) return 1;
      continue;
    }
    if (typeof leftValue === 'number' && typeof rightValue === 'number') {
      if (leftValue !== rightValue) return leftValue - rightValue;
      continue;
    }
  }

  if (left.candidateRank !== right.candidateRank) {
    return left.candidateRank - right.candidateRank;
  }
  return left.sourceSceneId.localeCompare(right.sourceSceneId);
}

function editorialTuple(
  candidate: EditorialBrainCandidateEvidenceV1,
  previous: EditorialBrainCandidateEvidenceV1 | undefined,
  seenSourceScenes: ReadonlySet<string>,
  targetDurationMs: number,
  frameRate: EditorialPlanFrameRate,
): readonly [number, number, number, bigint] {
  const repeatPenalty = seenSourceScenes.has(candidate.sourceSceneId) ? 1 : 0;
  const continuityPenalty =
    previous === undefined || previous.continuityGroupId === candidate.continuityGroupId ? 0 : 1;
  const varietyPenalty = previous === undefined
    ? 0
    : Number(previous.shotType === candidate.shotType)
      + Number(previous.movementType === candidate.movementType);

  const durationNumerator =
    BigInt(candidate.durationFrames)
    * BigInt(frameRate.denominator)
    * 1000n;
  const targetNumerator = BigInt(targetDurationMs) * BigInt(frameRate.numerator);
  const pacingDistance = durationNumerator >= targetNumerator
    ? durationNumerator - targetNumerator
    : targetNumerator - durationNumerator;

  return [repeatPenalty, continuityPenalty, varietyPenalty, pacingDistance];
}
