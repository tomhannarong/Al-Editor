export const CONTENT_AGENT_ORCHESTRATION_SCHEMA_VERSION = '1.0' as const;
export const CONTENT_AGENT_ORCHESTRATION_AUTHORITY = 'orchestration-only' as const;

export const CONTENT_AGENT_CAPABILITIES = [
  'media.ingest',
  'scene.index',
  'voice.align',
  'scene.retrieve',
  'scene.rerank',
  'editorial.plan',
  'timeline.revise',
  'preview.render',
  'final.validate',
  'human-review.record',
  'interchange.export',
] as const;

export type ContentAgentCapabilityV1 = (typeof CONTENT_AGENT_CAPABILITIES)[number];

export interface ContentAgentCapabilityRefV1 {
  capability: ContentAgentCapabilityV1;
  contractRevision: string;
}

export interface ContentAgentStepV1 {
  stepId: string;
  capability: ContentAgentCapabilityV1;
  contractRevision: string;
  inputRef: string;
  outputRef: string;
  dependsOnStepIds: readonly string[];
}

export interface ContentAgentPlanV1 {
  schemaVersion: typeof CONTENT_AGENT_ORCHESTRATION_SCHEMA_VERSION;
  authority: typeof CONTENT_AGENT_ORCHESTRATION_AUTHORITY;
  planId: string;
  projectId: string;
  requestedBy: string;
  capabilities: readonly ContentAgentCapabilityRefV1[];
  steps: readonly ContentAgentStepV1[];
}

export interface ContentAgentValidationResultV1 {
  valid: boolean;
  errors: string[];
}

const MUTABLE_ALIASES = new Set(['latest', 'main', 'master', 'stable', 'default', 'current', 'head']);
const nonEmpty = (value: string): boolean => value.trim().length > 0;
const pinned = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && !MUTABLE_ALIASES.has(normalized);
};

export function validateContentAgentPlanV1(plan: ContentAgentPlanV1): ContentAgentValidationResultV1 {
  const errors: string[] = [];
  if (plan.schemaVersion !== CONTENT_AGENT_ORCHESTRATION_SCHEMA_VERSION) errors.push('schemaVersion must be 1.0');
  if (plan.authority !== CONTENT_AGENT_ORCHESTRATION_AUTHORITY) errors.push('content agent must remain orchestration-only');
  if (!nonEmpty(plan.planId)) errors.push('planId is required');
  if (!nonEmpty(plan.projectId)) errors.push('projectId is required');
  if (!nonEmpty(plan.requestedBy)) errors.push('requestedBy is required');
  if (plan.steps.length === 0) errors.push('steps must not be empty');

  const declared = new Map<ContentAgentCapabilityV1, string>();
  for (const [index, ref] of plan.capabilities.entries()) {
    if (!CONTENT_AGENT_CAPABILITIES.includes(ref.capability)) errors.push(`capabilities[${index}].capability is unsupported`);
    if (!pinned(ref.contractRevision)) errors.push(`capabilities[${index}].contractRevision must be pinned`);
    const existing = declared.get(ref.capability);
    if (existing && existing !== ref.contractRevision) errors.push(`capability ${ref.capability} cannot declare conflicting revisions`);
    declared.set(ref.capability, ref.contractRevision);
  }

  const stepIds = new Set<string>();
  for (const [index, step] of plan.steps.entries()) {
    if (!nonEmpty(step.stepId)) errors.push(`steps[${index}].stepId is required`);
    else if (stepIds.has(step.stepId)) errors.push(`steps[${index}].stepId must be unique`);
    else stepIds.add(step.stepId);
    if (!CONTENT_AGENT_CAPABILITIES.includes(step.capability)) errors.push(`steps[${index}].capability is unsupported`);
    if (!pinned(step.contractRevision)) errors.push(`steps[${index}].contractRevision must be pinned`);
    if (!nonEmpty(step.inputRef) || !nonEmpty(step.outputRef)) errors.push(`steps[${index}] inputRef/outputRef are required`);
    const declaredRevision = declared.get(step.capability);
    if (!declaredRevision) errors.push(`steps[${index}] capability ${step.capability} must be explicitly declared`);
    else if (declaredRevision !== step.contractRevision) errors.push(`steps[${index}] contractRevision must match declared capability revision`);
  }

  const seen = new Set<string>();
  for (const [index, step] of plan.steps.entries()) {
    for (const dependency of step.dependsOnStepIds) {
      if (!seen.has(dependency)) errors.push(`steps[${index}] dependency ${dependency} must reference an earlier step`);
      if (dependency === step.stepId) errors.push(`steps[${index}] cannot depend on itself`);
    }
    seen.add(step.stepId);
  }

  return { valid: errors.length === 0, errors };
}
