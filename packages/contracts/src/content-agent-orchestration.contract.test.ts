import { describe, expect, it } from 'vitest';
import {
  CONTENT_AGENT_ORCHESTRATION_AUTHORITY,
  CONTENT_AGENT_ORCHESTRATION_SCHEMA_VERSION,
  type ContentAgentPlanV1,
  validateContentAgentPlanV1,
} from './content-agent-orchestration.contract.js';

const validPlan = (): ContentAgentPlanV1 => ({
  schemaVersion: CONTENT_AGENT_ORCHESTRATION_SCHEMA_VERSION,
  authority: CONTENT_AGENT_ORCHESTRATION_AUTHORITY,
  planId: 'content-agent-plan:demo:r1',
  projectId: 'project:demo',
  requestedBy: 'user:demo',
  capabilities: [
    { capability: 'scene.retrieve', contractRevision: 'baseline-scene-retrieval-query:r1' },
    { capability: 'editorial.plan', contractRevision: 'editorial-brain-planning-policy:r1' },
    { capability: 'timeline.revise', contractRevision: 'canonical-timeline:v2' },
    { capability: 'preview.render', contractRevision: 'renderer-adapter:v2' },
  ],
  steps: [
    { stepId: 'retrieve', capability: 'scene.retrieve', contractRevision: 'baseline-scene-retrieval-query:r1', inputRef: 'editorial-segments:r7', outputRef: 'retrieval:r1', dependsOnStepIds: [] },
    { stepId: 'plan', capability: 'editorial.plan', contractRevision: 'editorial-brain-planning-policy:r1', inputRef: 'retrieval:r1', outputRef: 'editorial-plan:r1', dependsOnStepIds: ['retrieve'] },
    { stepId: 'revise', capability: 'timeline.revise', contractRevision: 'canonical-timeline:v2', inputRef: 'editorial-plan:r1', outputRef: 'timeline-revision:r9', dependsOnStepIds: ['plan'] },
    { stepId: 'preview', capability: 'preview.render', contractRevision: 'renderer-adapter:v2', inputRef: 'timeline-revision:r9', outputRef: 'preview:r1', dependsOnStepIds: ['revise'] },
  ],
});

describe('content agent orchestration boundary', () => {
  it('accepts an orchestration-only plan over explicitly declared pinned capabilities', () => {
    expect(validateContentAgentPlanV1(validPlan())).toEqual({ valid: true, errors: [] });
  });

  it('rejects mutable capability revisions', () => {
    const plan = validPlan();
    plan.capabilities = [{ capability: 'scene.retrieve', contractRevision: 'latest' }];
    expect(validateContentAgentPlanV1(plan).valid).toBe(false);
  });

  it('rejects steps that bypass the declared capability boundary', () => {
    const plan = validPlan();
    plan.capabilities = plan.capabilities.filter((entry) => entry.capability !== 'preview.render');
    expect(validateContentAgentPlanV1(plan).errors).toContain('steps[3] capability preview.render must be explicitly declared');
  });

  it('rejects dependency edges that point forward and could hide a parallel workflow', () => {
    const plan = validPlan();
    plan.steps = [
      { ...plan.steps[0]!, dependsOnStepIds: ['plan'] },
      ...plan.steps.slice(1),
    ];
    expect(validateContentAgentPlanV1(plan).errors).toContain('steps[0] dependency plan must reference an earlier step');
  });
});
