import { describe, expect, it } from 'vitest';

import type { ContentAgentPlanV1 } from '../../contracts/src/content-agent-orchestration.contract.js';
import type { DeliveryProfileV1 } from '../../contracts/src/delivery-profile.contract.js';
import type { EditorialBrainPlanningPolicy } from '../../contracts/src/editorial-brain-planning-policy.contract.js';
import type { EditorialStyleProfileV1 } from '../../contracts/src/editorial-style-profile.contract.js';
import type { EditorialBrainPlanningExecutionRequestV1 } from '../../editorial-brain-library/src/execution.js';
import {
  FINAL_DELIVERY_MEASUREMENT_SCHEMA_VERSION,
  type FinalDeliveryMeasurementV1,
} from '../../final-delivery-validator/src/index.js';
import { executeContentAgentPlanV1 } from './execution.js';
import {
  CONTENT_AGENT_EDITORIAL_PLAN_ADAPTER_REVISION,
  CONTENT_AGENT_FINAL_VALIDATE_ADAPTER_REVISION,
  ExistingCapabilityAdapterInvariantError,
  createExistingCapabilityAdaptersV1,
} from './existing-capability-adapters.js';

const styleProfile: EditorialStyleProfileV1 = {
  schemaVersion: '1.0', profileId: 'travel-soft-v1', profileVersion: '1.0.0', status: 'approved',
  brandAuthority: { brandId: 'brand-1', brandVersion: 'v1', videoStyleDnaDocument: { documentId: 'dna', version: 'v1' } },
  duration: { targetShotDurationMs: 2000, hookShotDurationMs: 1000, minShotDurationMs: 500, maxShotDurationMs: 3000 },
  variety: { maxConsecutiveSameShotType: 2, preferredHumanPresenceIntervalMs: 5000, penalizeNearDuplicates: true },
  movement: { movementPreferenceWeight: 0.5, repeatedMovementPenaltyWeight: 0.5 },
  transitions: { hardCutWeight: 1, maxNonCutTransitionRatio: 0.2 },
  scoring: { semanticRelevance: 1, visualQuality: 1, continuity: 1, variety: 1, novelty: 1 },
  createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
};

const policy: EditorialBrainPlanningPolicy = {
  schemaVersion: '1.0', policyId: 'editorial-brain-travel-v1', revisionId: 'editorial-brain-travel-v1:r1',
  benchmarkControl: { benchmarkRevisionId: 'phase8-editorial-quality-baseline:v1', fixtureRevisionId: 'phase8-editorial-quality-fixture:v1', controlPlanRevisionId: 'agent-plan:r1', evaluationPolicyRevisionId: 'editorial-quality-evaluation-policy:v1' },
  styleProfile: { profileId: styleProfile.profileId, profileVersion: styleProfile.profileVersion },
  planningMethod: 'deterministic-style-guided-greedy-v1', candidatePoolSize: 12,
  objectives: { pacing: 'style-duration-fit-v1', continuity: 'adjacent-continuity-group-v1', variety: 'shot-type-and-movement-change-v1', repeatControl: 'source-scene-repeat-penalty-v1' },
  tieBreak: 'candidate-rank-then-scene-id-v1', createdAt: '2026-08-27T01:00:00.000Z',
};

const editorialRequest: EditorialBrainPlanningExecutionRequestV1 = {
  schemaVersion: '1.0', fixtureRevisionId: 'phase8-editorial-quality-fixture:v1', planId: 'agent-plan', revisionId: 'agent-plan:r2',
  frameRate: { numerator: 30, denominator: 1 },
  slots: [{ slotId: 'slot-1', candidates: [{ candidateId: 'candidate-1', candidateRank: 1, sourceSceneId: 'scene-1', shotType: 'wide', movementType: 'static', continuityGroupId: 'location-1', durationFrames: 30 }] }],
};

const deliveryProfile: DeliveryProfileV1 = {
  schemaVersion: '1.0', profileId: 'delivery-tiktok-1080x1920', profileVersion: '1.0.0', status: 'approved', platform: 'tiktok',
  video: { container: 'mp4', codec: 'h264', pixelFormat: 'yuv420p', width: 1080, height: 1920, frameRate: { numerator: 30000, denominator: 1001 }, colorPrimaries: 'bt709', colorTransfer: 'bt709', colorMatrix: 'bt709', colorRange: 'limited', hdrPolicy: 'reject-hdr', maxVideoBitrateKbps: 12000 },
  audio: { codec: 'aac', sampleRateHz: 48000, channels: 2, integratedLufsTarget: -14, truePeakDbtpMax: -1 },
  captions: { mode: 'both', safeAreaPercent: 8, maxLines: 2, sidecarFormat: 'srt' },
  createdAt: '2026-08-25T00:00:00.000Z', updatedAt: '2026-08-25T00:00:00.000Z',
};

const deliveryMeasurement: FinalDeliveryMeasurementV1 = {
  schemaVersion: FINAL_DELIVERY_MEASUREMENT_SCHEMA_VERSION, deliveryProfileId: deliveryProfile.profileId, deliveryProfileVersion: deliveryProfile.profileVersion,
  video: { container: 'mp4', codec: 'h264', pixelFormat: 'yuv420p', width: 1080, height: 1920, frameRate: { numerator: 30000, denominator: 1001 }, colorPrimaries: 'bt709', colorTransfer: 'bt709', colorMatrix: 'bt709', colorRange: 'limited', averageVideoBitrateKbps: 8000 },
  audio: { codec: 'aac', sampleRateHz: 48000, channels: 2, integratedLufs: -14, truePeakDbtp: -1.2 },
  captions: { burnedIn: true, sidecarFormat: 'srt', safeAreaPercent: 10, maxRenderedLines: 2 },
};

const plan: ContentAgentPlanV1 = {
  schemaVersion: '1.0', authority: 'orchestration-only', planId: 'content-agent-plan:r1', projectId: 'project-1', requestedBy: 'user-1',
  capabilities: [
    { capability: 'editorial.plan', contractRevision: CONTENT_AGENT_EDITORIAL_PLAN_ADAPTER_REVISION },
    { capability: 'final.validate', contractRevision: CONTENT_AGENT_FINAL_VALIDATE_ADAPTER_REVISION },
  ],
  steps: [
    { stepId: 'plan', capability: 'editorial.plan', contractRevision: CONTENT_AGENT_EDITORIAL_PLAN_ADAPTER_REVISION, inputRef: 'editorial-input:r1', outputRef: 'editorial-plan:agent-plan:r2', dependsOnStepIds: [] },
    { stepId: 'validate', capability: 'final.validate', contractRevision: CONTENT_AGENT_FINAL_VALIDATE_ADAPTER_REVISION, inputRef: 'delivery-input:r1', outputRef: 'final-delivery-valid:delivery-tiktok-1080x1920:1.0.0', dependsOnStepIds: ['plan'] },
  ],
};

function adapters(measurement: FinalDeliveryMeasurementV1 = deliveryMeasurement) {
  return createExistingCapabilityAdaptersV1({
    editorialPlanInputs: new Map([['editorial-input:r1', { request: editorialRequest, policy, styleProfile, evidenceRef: 'evidence:editorial-brain:r1' }]]),
    finalValidationInputs: new Map([['delivery-input:r1', { profile: deliveryProfile, measurement, evidenceRef: 'evidence:delivery-validation:r1' }]]),
  });
}

describe('Content Agent bindings to existing capability surfaces', () => {
  it('delegates a representative ordered path to verified Editorial Brain and final-delivery implementations', async () => {
    const result = await executeContentAgentPlanV1(plan, adapters());
    expect(result.authority).toBe('orchestration-evidence-only');
    expect(result.steps.map((step) => [step.capability, step.outputRef])).toEqual([
      ['editorial.plan', 'editorial-plan:agent-plan:r2'],
      ['final.validate', 'final-delivery-valid:delivery-tiktok-1080x1920:1.0.0'],
    ]);
    expect(result.steps[1]?.dependencyStepIds).toEqual(['plan']);
  });

  it('propagates rejection from the existing final-delivery validator instead of reproducing validation rules in the agent', async () => {
    const invalid = structuredClone(deliveryMeasurement);
    invalid.video.codec = 'hevc';
    await expect(executeContentAgentPlanV1(plan, adapters(invalid))).rejects.toThrow(ExistingCapabilityAdapterInvariantError);
  });

  it('registers only the explicitly wrapped existing capabilities and pinned revisions', () => {
    expect(adapters().map(({ capability, contractRevision }) => ({ capability, contractRevision }))).toEqual([
      { capability: 'editorial.plan', contractRevision: CONTENT_AGENT_EDITORIAL_PLAN_ADAPTER_REVISION },
      { capability: 'final.validate', contractRevision: CONTENT_AGENT_FINAL_VALIDATE_ADAPTER_REVISION },
    ]);
  });
});
