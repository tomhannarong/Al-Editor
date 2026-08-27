import { describe, expect, it, vi } from 'vitest';
import {
  CONTENT_AGENT_ORCHESTRATION_AUTHORITY,
  CONTENT_AGENT_ORCHESTRATION_SCHEMA_VERSION,
  type ContentAgentPlanV1,
} from '../../contracts/src/content-agent-orchestration.contract.js';
import {
  CONTENT_AGENT_EXECUTION_AUTHORITY,
  CONTENT_AGENT_EXECUTION_SCHEMA_VERSION,
  executeContentAgentPlanV1,
  type ContentAgentCapabilityAdapterV1,
} from './execution.js';

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
  ],
  steps: [
    { stepId: 'retrieve', capability: 'scene.retrieve', contractRevision: 'baseline-scene-retrieval-query:r1', inputRef: 'segments:r7', outputRef: 'retrieval:r1', dependsOnStepIds: [] },
    { stepId: 'plan', capability: 'editorial.plan', contractRevision: 'editorial-brain-planning-policy:r1', inputRef: 'retrieval:r1', outputRef: 'editorial-plan:r1', dependsOnStepIds: ['retrieve'] },
    { stepId: 'revise', capability: 'timeline.revise', contractRevision: 'canonical-timeline:v2', inputRef: 'editorial-plan:r1', outputRef: 'timeline:r9', dependsOnStepIds: ['plan'] },
  ],
});

function adapter(
  capability: ContentAgentCapabilityAdapterV1['capability'],
  contractRevision: string,
  outputRef: string,
  order: string[],
): ContentAgentCapabilityAdapterV1 {
  return {
    capability,
    contractRevision,
    execute: vi.fn(async (request) => {
      order.push(request.stepId);
      return {
        capability,
        contractRevision,
        outputRef,
        evidenceRef: `evidence:${request.stepId}:r1`,
      };
    }),
  };
}

describe('content agent deterministic executor', () => {
  it('executes declared adapters sequentially and returns orchestration evidence only', async () => {
    const order: string[] = [];
    const adapters = [
      adapter('scene.retrieve', 'baseline-scene-retrieval-query:r1', 'retrieval:r1', order),
      adapter('editorial.plan', 'editorial-brain-planning-policy:r1', 'editorial-plan:r1', order),
      adapter('timeline.revise', 'canonical-timeline:v2', 'timeline:r9', order),
    ];

    const result = await executeContentAgentPlanV1(validPlan(), adapters);

    expect(order).toEqual(['retrieve', 'plan', 'revise']);
    expect(result.schemaVersion).toBe(CONTENT_AGENT_EXECUTION_SCHEMA_VERSION);
    expect(result.authority).toBe(CONTENT_AGENT_EXECUTION_AUTHORITY);
    expect(result.steps.map((step) => step.outputRef)).toEqual(['retrieval:r1', 'editorial-plan:r1', 'timeline:r9']);
    expect(result.steps[1]!.dependencyStepIds).toEqual(['retrieve']);

    const planAdapter = adapters[1]!;
    expect(planAdapter.execute).toHaveBeenCalledWith(expect.objectContaining({
      stepId: 'plan',
      inputRef: 'retrieval:r1',
      expectedOutputRef: 'editorial-plan:r1',
      dependencyOutputs: [{ stepId: 'retrieve', outputRef: 'retrieval:r1', evidenceRef: 'evidence:retrieve:r1' }],
    }));
  });

  it('fails before invoking any adapter when the plan is invalid', async () => {
    const plan = validPlan();
    plan.authority = 'hidden-workflow' as typeof plan.authority;
    const execute = vi.fn();

    await expect(executeContentAgentPlanV1(plan, [{
      capability: 'scene.retrieve',
      contractRevision: 'baseline-scene-retrieval-query:r1',
      execute,
    }])).rejects.toMatchObject({ code: 'invalid-plan' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('fails closed on a missing or wrong-revision adapter', async () => {
    const plan = validPlan();
    const order: string[] = [];
    const retrieve = adapter('scene.retrieve', 'baseline-scene-retrieval-query:r1', 'retrieval:r1', order);

    await expect(executeContentAgentPlanV1(plan, [retrieve])).rejects.toMatchObject({ code: 'missing-adapter' });

    const wrongPlanAdapter = adapter('editorial.plan', 'editorial-brain-planning-policy:r2', 'editorial-plan:r1', order);
    await expect(executeContentAgentPlanV1(plan, [
      retrieve,
      wrongPlanAdapter,
      adapter('timeline.revise', 'canonical-timeline:v2', 'timeline:r9', order),
    ])).rejects.toMatchObject({ code: 'adapter-revision-mismatch' });
  });

  it('stops immediately when an adapter returns a mismatched output reference', async () => {
    const order: string[] = [];
    const revise = adapter('timeline.revise', 'canonical-timeline:v2', 'timeline:r9', order);

    await expect(executeContentAgentPlanV1(validPlan(), [
      adapter('scene.retrieve', 'baseline-scene-retrieval-query:r1', 'retrieval:r1', order),
      adapter('editorial.plan', 'editorial-brain-planning-policy:r1', 'wrong-output:r1', order),
      revise,
    ])).rejects.toMatchObject({ code: 'adapter-result-mismatch' });

    expect(order).toEqual(['retrieve', 'plan']);
    expect(revise.execute).not.toHaveBeenCalled();
  });

  it('rejects duplicate capability adapters instead of choosing one implicitly', async () => {
    const order: string[] = [];
    const first = adapter('scene.retrieve', 'baseline-scene-retrieval-query:r1', 'retrieval:r1', order);
    const second = adapter('scene.retrieve', 'baseline-scene-retrieval-query:r1', 'retrieval:r1', order);

    await expect(executeContentAgentPlanV1(validPlan(), [first, second])).rejects.toMatchObject({
      code: 'duplicate-adapter',
    });
  });
});
