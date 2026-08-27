import {
  type ContentAgentCapabilityV1,
  type ContentAgentPlanV1,
  type ContentAgentStepV1,
  validateContentAgentPlanV1,
} from '../../contracts/src/content-agent-orchestration.contract.js';

export const CONTENT_AGENT_EXECUTION_SCHEMA_VERSION = '1.0' as const;
export const CONTENT_AGENT_EXECUTION_AUTHORITY = 'orchestration-evidence-only' as const;

export interface ContentAgentDependencyOutputV1 {
  stepId: string;
  outputRef: string;
  evidenceRef: string;
}

export interface ContentAgentAdapterRequestV1 {
  planId: string;
  projectId: string;
  requestedBy: string;
  stepId: string;
  capability: ContentAgentCapabilityV1;
  contractRevision: string;
  inputRef: string;
  expectedOutputRef: string;
  dependencyOutputs: readonly ContentAgentDependencyOutputV1[];
}

export interface ContentAgentAdapterResultV1 {
  capability: ContentAgentCapabilityV1;
  contractRevision: string;
  outputRef: string;
  evidenceRef: string;
}

export interface ContentAgentCapabilityAdapterV1 {
  capability: ContentAgentCapabilityV1;
  contractRevision: string;
  execute(request: ContentAgentAdapterRequestV1): Promise<ContentAgentAdapterResultV1>;
}

export interface ContentAgentStepExecutionEvidenceV1 {
  stepId: string;
  capability: ContentAgentCapabilityV1;
  contractRevision: string;
  inputRef: string;
  outputRef: string;
  evidenceRef: string;
  dependencyStepIds: readonly string[];
}

export interface ContentAgentExecutionEvidenceV1 {
  schemaVersion: typeof CONTENT_AGENT_EXECUTION_SCHEMA_VERSION;
  authority: typeof CONTENT_AGENT_EXECUTION_AUTHORITY;
  planId: string;
  projectId: string;
  requestedBy: string;
  steps: readonly ContentAgentStepExecutionEvidenceV1[];
}

export type ContentAgentExecutionErrorCodeV1 =
  | 'invalid-plan'
  | 'duplicate-adapter'
  | 'missing-adapter'
  | 'adapter-revision-mismatch'
  | 'missing-dependency-output'
  | 'adapter-result-mismatch'
  | 'invalid-evidence-ref';

export class ContentAgentExecutionInvariantError extends Error {
  constructor(
    readonly code: ContentAgentExecutionErrorCodeV1,
    message: string,
  ) {
    super(message);
    this.name = 'ContentAgentExecutionInvariantError';
  }
}

/**
 * Executes only an already-declared Content Agent orchestration plan.
 *
 * The executor owns no ingest, retrieval, planning, timeline, render, export,
 * persistence or media-time behavior. Every side effect remains behind an
 * injected adapter whose capability and pinned contract revision must match
 * the validated plan exactly. The returned value is orchestration evidence
 * composed only of stable references emitted by those existing capabilities.
 */
export async function executeContentAgentPlanV1(
  plan: ContentAgentPlanV1,
  adapters: readonly ContentAgentCapabilityAdapterV1[],
): Promise<ContentAgentExecutionEvidenceV1> {
  const validation = validateContentAgentPlanV1(plan);
  if (!validation.valid) {
    throw new ContentAgentExecutionInvariantError(
      'invalid-plan',
      `invalid content agent plan: ${validation.errors.join('; ')}`,
    );
  }

  const adapterIndex = indexAdapters(adapters);
  const completed = new Map<string, ContentAgentStepExecutionEvidenceV1>();
  const evidence: ContentAgentStepExecutionEvidenceV1[] = [];

  for (const step of plan.steps) {
    const adapter = adapterIndex.get(step.capability);
    if (!adapter) {
      throw new ContentAgentExecutionInvariantError(
        'missing-adapter',
        `step ${step.stepId} has no adapter for ${step.capability}`,
      );
    }
    if (adapter.contractRevision !== step.contractRevision) {
      throw new ContentAgentExecutionInvariantError(
        'adapter-revision-mismatch',
        `step ${step.stepId} adapter revision ${adapter.contractRevision} does not match ${step.contractRevision}`,
      );
    }

    const dependencyOutputs = resolveDependencies(step, completed);
    const result = await adapter.execute(Object.freeze({
      planId: plan.planId,
      projectId: plan.projectId,
      requestedBy: plan.requestedBy,
      stepId: step.stepId,
      capability: step.capability,
      contractRevision: step.contractRevision,
      inputRef: step.inputRef,
      expectedOutputRef: step.outputRef,
      dependencyOutputs,
    }));

    validateAdapterResult(step, result);
    const stepEvidence: ContentAgentStepExecutionEvidenceV1 = Object.freeze({
      stepId: step.stepId,
      capability: step.capability,
      contractRevision: step.contractRevision,
      inputRef: step.inputRef,
      outputRef: result.outputRef,
      evidenceRef: result.evidenceRef,
      dependencyStepIds: Object.freeze([...step.dependsOnStepIds]),
    });
    completed.set(step.stepId, stepEvidence);
    evidence.push(stepEvidence);
  }

  return Object.freeze({
    schemaVersion: CONTENT_AGENT_EXECUTION_SCHEMA_VERSION,
    authority: CONTENT_AGENT_EXECUTION_AUTHORITY,
    planId: plan.planId,
    projectId: plan.projectId,
    requestedBy: plan.requestedBy,
    steps: Object.freeze(evidence),
  });
}

function indexAdapters(
  adapters: readonly ContentAgentCapabilityAdapterV1[],
): Map<ContentAgentCapabilityV1, ContentAgentCapabilityAdapterV1> {
  const indexed = new Map<ContentAgentCapabilityV1, ContentAgentCapabilityAdapterV1>();
  for (const adapter of adapters) {
    if (indexed.has(adapter.capability)) {
      throw new ContentAgentExecutionInvariantError(
        'duplicate-adapter',
        `multiple adapters registered for ${adapter.capability}`,
      );
    }
    indexed.set(adapter.capability, adapter);
  }
  return indexed;
}

function resolveDependencies(
  step: ContentAgentStepV1,
  completed: ReadonlyMap<string, ContentAgentStepExecutionEvidenceV1>,
): readonly ContentAgentDependencyOutputV1[] {
  return Object.freeze(step.dependsOnStepIds.map((stepId) => {
    const dependency = completed.get(stepId);
    if (!dependency) {
      throw new ContentAgentExecutionInvariantError(
        'missing-dependency-output',
        `step ${step.stepId} dependency ${stepId} has no completed output`,
      );
    }
    return Object.freeze({
      stepId: dependency.stepId,
      outputRef: dependency.outputRef,
      evidenceRef: dependency.evidenceRef,
    });
  }));
}

function validateAdapterResult(
  step: ContentAgentStepV1,
  result: ContentAgentAdapterResultV1,
): void {
  if (
    result.capability !== step.capability
    || result.contractRevision !== step.contractRevision
    || result.outputRef !== step.outputRef
  ) {
    throw new ContentAgentExecutionInvariantError(
      'adapter-result-mismatch',
      `step ${step.stepId} adapter result does not match declared capability/revision/output`,
    );
  }
  if (!result.evidenceRef.trim()) {
    throw new ContentAgentExecutionInvariantError(
      'invalid-evidence-ref',
      `step ${step.stepId} adapter evidenceRef is required`,
    );
  }
}
