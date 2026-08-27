import { describe, expect, it } from 'vitest';

import {
  EDITORIAL_BRAIN_PLANNING_POLICY_SCHEMA_VERSION,
  PHASE8_EDITORIAL_QUALITY_BASELINE_REVISION_ID,
  validateEditorialBrainPlanningPolicy,
  type EditorialBrainPlanningPolicy,
} from './editorial-brain-planning-policy.contract.js';

function validPolicy(): EditorialBrainPlanningPolicy {
  return {
    schemaVersion: EDITORIAL_BRAIN_PLANNING_POLICY_SCHEMA_VERSION,
    policyId: 'editorial-brain:travel-soft:v1',
    revisionId: 'editorial-brain:travel-soft:v1:r1',
    benchmarkControl: {
      benchmarkRevisionId: PHASE8_EDITORIAL_QUALITY_BASELINE_REVISION_ID,
      fixtureRevisionId: 'phase8-editorial-quality-fixture:v1',
      controlPlanRevisionId: 'plan-a:r1',
      evaluationPolicyRevisionId: 'editorial-quality-evaluation-policy:v1',
    },
    styleProfile: {
      profileId: 'travel-soft-v1',
      profileVersion: '1.0.0',
    },
    planningMethod: 'deterministic-style-guided-greedy-v1',
    candidatePoolSize: 50,
    objectives: {
      pacing: 'style-duration-fit-v1',
      continuity: 'adjacent-continuity-group-v1',
      variety: 'shot-type-and-movement-change-v1',
      repeatControl: 'source-scene-repeat-penalty-v1',
    },
    tieBreak: 'candidate-rank-then-scene-id-v1',
    createdAt: '2026-08-27T08:20:00.000Z',
  };
}

describe('editorial brain planning policy contract', () => {
  it('accepts a deterministic versioned policy pinned to the frozen Phase-8 baseline and Style Profile v1', () => {
    expect(validateEditorialBrainPlanningPolicy(validPolicy())).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('requires exact benchmark-control and style-profile references', () => {
    const policy = validPolicy();
    policy.benchmarkControl.fixtureRevisionId = ' ';
    policy.benchmarkControl.controlPlanRevisionId = '';
    policy.styleProfile.profileVersion = ' ';

    const result = validateEditorialBrainPlanningPolicy(policy);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('benchmarkControl.fixtureRevisionId is required');
    expect(result.errors).toContain('benchmarkControl.controlPlanRevisionId is required');
    expect(result.errors).toContain('styleProfile.profileVersion is required');
  });

  it('bounds candidate work before editorial planning', () => {
    const policy = validPolicy();
    policy.candidatePoolSize = 1_001;

    const result = validateEditorialBrainPlanningPolicy(policy);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('candidatePoolSize must be a safe integer between 1 and 1000');
  });

  it('pins deterministic planning objectives and tie-breaking', () => {
    const policy = validPolicy();
    const malformed = policy as unknown as {
      planningMethod: string;
      objectives: {
        pacing: string;
        continuity: string;
        variety: string;
        repeatControl: string;
      };
      tieBreak: string;
    };
    malformed.planningMethod = 'opaque-model-planner';
    malformed.objectives.variety = 'unversioned-variety';
    malformed.tieBreak = 'random';

    const result = validateEditorialBrainPlanningPolicy(policy);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('unsupported planningMethod');
    expect(result.errors).toContain('unsupported variety objective');
    expect(result.errors).toContain('unsupported tieBreak');
  });

  it('keeps retrieval relevance, model output and alternate timing authority outside the policy contract', () => {
    const policy = validPolicy();

    expect('retrievalScore' in policy).toBe(false);
    expect('modelPrompt' in policy).toBe(false);
    expect('milliseconds' in policy).toBe(false);
    expect('sourcePts' in policy).toBe(false);
    expect('projectFrames' in policy).toBe(false);
  });
});
