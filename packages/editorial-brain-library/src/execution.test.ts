import { describe, expect, it } from 'vitest';

import type { EditorialBrainPlanningPolicy } from '../../contracts/src/editorial-brain-planning-policy.contract.js';
import type { EditorialStyleProfileV1 } from '../../contracts/src/editorial-style-profile.contract.js';
import {
  EditorialBrainExecutionInvariantError,
  executeEditorialBrainPlanningV1,
  type EditorialBrainPlanningExecutionRequestV1,
} from './execution.js';

const styleProfile: EditorialStyleProfileV1 = {
  schemaVersion: '1.0',
  profileId: 'travel-soft-v1',
  profileVersion: '1.0.0',
  status: 'approved',
  brandAuthority: {
    brandId: 'brand-1',
    brandVersion: 'v1',
    videoStyleDnaDocument: { documentId: 'video-style-dna', version: 'v1' },
  },
  duration: {
    targetShotDurationMs: 2000,
    hookShotDurationMs: 1000,
    minShotDurationMs: 500,
    maxShotDurationMs: 3000,
  },
  variety: {
    maxConsecutiveSameShotType: 2,
    preferredHumanPresenceIntervalMs: 5000,
    penalizeNearDuplicates: true,
  },
  movement: {
    movementPreferenceWeight: 0.5,
    repeatedMovementPenaltyWeight: 0.5,
  },
  transitions: { hardCutWeight: 1, maxNonCutTransitionRatio: 0.2 },
  scoring: {
    semanticRelevance: 1,
    visualQuality: 1,
    continuity: 1,
    variety: 1,
    novelty: 1,
  },
  createdAt: '2026-08-27T00:00:00.000Z',
  updatedAt: '2026-08-27T00:00:00.000Z',
};

const policy: EditorialBrainPlanningPolicy = {
  schemaVersion: '1.0',
  policyId: 'editorial-brain-travel-v1',
  revisionId: 'editorial-brain-travel-v1:r1',
  benchmarkControl: {
    benchmarkRevisionId: 'phase8-editorial-quality-baseline:v1',
    fixtureRevisionId: 'phase8-editorial-quality-fixture:v1',
    controlPlanRevisionId: 'plan-a:r1',
    evaluationPolicyRevisionId: 'editorial-quality-evaluation-policy:v1',
  },
  styleProfile: {
    profileId: styleProfile.profileId,
    profileVersion: styleProfile.profileVersion,
  },
  planningMethod: 'deterministic-style-guided-greedy-v1',
  candidatePoolSize: 12,
  objectives: {
    pacing: 'style-duration-fit-v1',
    continuity: 'adjacent-continuity-group-v1',
    variety: 'shot-type-and-movement-change-v1',
    repeatControl: 'source-scene-repeat-penalty-v1',
  },
  tieBreak: 'candidate-rank-then-scene-id-v1',
  createdAt: '2026-08-27T01:00:00.000Z',
};

const request: EditorialBrainPlanningExecutionRequestV1 = {
  schemaVersion: '1.0',
  fixtureRevisionId: 'phase8-editorial-quality-fixture:v1',
  planId: 'plan-a',
  revisionId: 'plan-a:r2',
  frameRate: { numerator: 30, denominator: 1 },
  slots: [
    {
      slotId: 'slot-1',
      candidates: [
        {
          candidateId: 'c1-slow',
          candidateRank: 1,
          sourceSceneId: 'scene-x',
          shotType: 'wide',
          movementType: 'static',
          continuityGroupId: 'location-a',
          durationFrames: 90,
        },
        {
          candidateId: 'c1-hook',
          candidateRank: 2,
          sourceSceneId: 'scene-a',
          shotType: 'wide',
          movementType: 'static',
          continuityGroupId: 'location-a',
          durationFrames: 30,
        },
      ],
    },
    {
      slotId: 'slot-2',
      candidates: [
        {
          candidateId: 'c2-repeat',
          candidateRank: 1,
          sourceSceneId: 'scene-a',
          shotType: 'wide',
          movementType: 'static',
          continuityGroupId: 'location-b',
          durationFrames: 60,
        },
        {
          candidateId: 'c2-variety',
          candidateRank: 2,
          sourceSceneId: 'scene-b',
          shotType: 'medium',
          movementType: 'pan',
          continuityGroupId: 'location-a',
          durationFrames: 60,
        },
      ],
    },
    {
      slotId: 'slot-3',
      candidates: [
        {
          candidateId: 'c3-break-continuity',
          candidateRank: 1,
          sourceSceneId: 'scene-d',
          shotType: 'close',
          movementType: 'push',
          continuityGroupId: 'location-b',
          durationFrames: 60,
        },
        {
          candidateId: 'c3-continuity',
          candidateRank: 2,
          sourceSceneId: 'scene-c',
          shotType: 'close',
          movementType: 'push',
          continuityGroupId: 'location-a',
          durationFrames: 60,
        },
      ],
    },
  ],
};

describe('deterministic Editorial Brain planning execution v1', () => {
  it('produces a distinct immutable after-plan using editorial objectives only', () => {
    const plan = executeEditorialBrainPlanningV1(request, policy, styleProfile);

    expect(plan).toEqual({
      schemaVersion: '1.0',
      fixtureRevisionId: 'phase8-editorial-quality-fixture:v1',
      planId: 'plan-a',
      revisionId: 'plan-a:r2',
      styleProfileId: 'travel-soft-v1',
      styleProfileVersion: '1.0.0',
      frameRate: { numerator: 30, denominator: 1 },
      shots: [
        {
          shotId: 'plan-a:r2:shot:1',
          sourceSceneId: 'scene-a',
          shotType: 'wide',
          movementType: 'static',
          continuityGroupId: 'location-a',
          startFrame: 0,
          endFrame: 30,
        },
        {
          shotId: 'plan-a:r2:shot:2',
          sourceSceneId: 'scene-b',
          shotType: 'medium',
          movementType: 'pan',
          continuityGroupId: 'location-a',
          startFrame: 30,
          endFrame: 90,
        },
        {
          shotId: 'plan-a:r2:shot:3',
          sourceSceneId: 'scene-c',
          shotType: 'close',
          movementType: 'push',
          continuityGroupId: 'location-a',
          startFrame: 90,
          endFrame: 150,
        },
      ],
    });
  });

  it('is deterministic when candidate input ordering changes', () => {
    const reversed: EditorialBrainPlanningExecutionRequestV1 = {
      ...request,
      slots: request.slots.map((slot) => ({
        ...slot,
        candidates: [...slot.candidates].reverse(),
      })),
    };

    expect(executeEditorialBrainPlanningV1(reversed, policy, styleProfile)).toEqual(
      executeEditorialBrainPlanningV1(request, policy, styleProfile),
    );
  });

  it('rejects fixture/style authority drift and control-revision reuse', () => {
    expect(() =>
      executeEditorialBrainPlanningV1(
        { ...request, fixtureRevisionId: 'other-fixture' },
        policy,
        styleProfile,
      ),
    ).toThrow(/benchmark-control fixture/);

    expect(() =>
      executeEditorialBrainPlanningV1(
        { ...request, revisionId: 'plan-a:r1' },
        policy,
        styleProfile,
      ),
    ).toThrow(/distinct from the frozen control revision/);

    expect(() =>
      executeEditorialBrainPlanningV1(
        request,
        policy,
        { ...styleProfile, profileVersion: 'other' },
      ),
    ).toThrow(/Style Profile authority/);
  });

  it('enforces bounded candidate work and integer-frame evidence', () => {
    expect(() =>
      executeEditorialBrainPlanningV1(
        request,
        { ...policy, candidatePoolSize: 5 },
        styleProfile,
      ),
    ).toThrow(/bounded policy pool 5/);

    const malformed: EditorialBrainPlanningExecutionRequestV1 = {
      ...request,
      slots: [
        {
          ...request.slots[0]!,
          candidates: [
            {
              ...request.slots[0]!.candidates[0]!,
              durationFrames: 30.5,
            },
          ],
        },
      ],
    };
    expect(() => executeEditorialBrainPlanningV1(malformed, policy, styleProfile)).toThrow(
      /durationFrames must be a positive safe integer/,
    );
  });

  it('uses candidate rank then scene ID only after editorial score ties', () => {
    const tieRequest: EditorialBrainPlanningExecutionRequestV1 = {
      ...request,
      slots: [
        {
          slotId: 'slot-tie',
          candidates: [
            {
              candidateId: 'tie-b',
              candidateRank: 2,
              sourceSceneId: 'scene-b',
              shotType: 'wide',
              movementType: 'static',
              continuityGroupId: 'location-a',
              durationFrames: 30,
            },
            {
              candidateId: 'tie-a',
              candidateRank: 1,
              sourceSceneId: 'scene-a',
              shotType: 'wide',
              movementType: 'static',
              continuityGroupId: 'location-a',
              durationFrames: 30,
            },
          ],
        },
      ],
    };

    const plan = executeEditorialBrainPlanningV1(tieRequest, policy, styleProfile);
    expect(plan.shots[0]?.sourceSceneId).toBe('scene-a');
  });

  it('fails closed on duplicate candidate identities or ranks', () => {
    const duplicateCandidateId: EditorialBrainPlanningExecutionRequestV1 = {
      ...request,
      slots: [request.slots[0]!, { ...request.slots[1]!, candidates: [
        { ...request.slots[1]!.candidates[0]!, candidateId: 'c1-slow' },
      ] }],
    };
    expect(() => executeEditorialBrainPlanningV1(duplicateCandidateId, policy, styleProfile)).toThrow(
      EditorialBrainExecutionInvariantError,
    );

    const duplicateRank: EditorialBrainPlanningExecutionRequestV1 = {
      ...request,
      slots: [{
        ...request.slots[0]!,
        candidates: request.slots[0]!.candidates.map((candidate) => ({ ...candidate, candidateRank: 1 })),
      }],
    };
    expect(() => executeEditorialBrainPlanningV1(duplicateRank, policy, styleProfile)).toThrow(
      /duplicate candidateRank/,
    );
  });
});
