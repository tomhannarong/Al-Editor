import type { DeliveryProfileV1 } from '../../contracts/src/delivery-profile.contract.js';
import type { EditorialBrainPlanningPolicy } from '../../contracts/src/editorial-brain-planning-policy.contract.js';
import type { EditorialStyleProfileV1 } from '../../contracts/src/editorial-style-profile.contract.js';
import {
  executeEditorialBrainPlanningV1,
  type EditorialBrainPlanningExecutionRequestV1,
} from '../../editorial-brain-library/src/execution.js';
import {
  validateFinalDeliveryAgainstProfileV1,
  type FinalDeliveryMeasurementV1,
} from '../../final-delivery-validator/src/index.js';
import type {
  ContentAgentCapabilityAdapterV1,
  ContentAgentAdapterResultV1,
} from './execution.js';

export const CONTENT_AGENT_EDITORIAL_PLAN_ADAPTER_REVISION = 'editorial-brain-execution:1.0' as const;
export const CONTENT_AGENT_FINAL_VALIDATE_ADAPTER_REVISION = 'final-delivery-validator:1.0' as const;

export interface ExistingEditorialPlanInputV1 {
  request: EditorialBrainPlanningExecutionRequestV1;
  policy: EditorialBrainPlanningPolicy;
  styleProfile: EditorialStyleProfileV1;
  evidenceRef: string;
}

export interface ExistingFinalValidationInputV1 {
  profile: DeliveryProfileV1;
  measurement: FinalDeliveryMeasurementV1;
  evidenceRef: string;
}

export interface ExistingCapabilityResourceStoreV1 {
  editorialPlanInputs: ReadonlyMap<string, ExistingEditorialPlanInputV1>;
  finalValidationInputs: ReadonlyMap<string, ExistingFinalValidationInputV1>;
}

export class ExistingCapabilityAdapterInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExistingCapabilityAdapterInvariantError';
  }
}

/**
 * Representative Phase-12 bindings to already-verified standalone capability
 * surfaces. These adapters translate Content Agent references into calls to the
 * existing implementations; they contain no editorial-planning or delivery-
 * validation algorithm of their own.
 */
export function createExistingCapabilityAdaptersV1(
  resources: ExistingCapabilityResourceStoreV1,
): readonly ContentAgentCapabilityAdapterV1[] {
  return Object.freeze([
    createEditorialPlanAdapter(resources.editorialPlanInputs),
    createFinalValidationAdapter(resources.finalValidationInputs),
  ]);
}

function createEditorialPlanAdapter(
  inputs: ReadonlyMap<string, ExistingEditorialPlanInputV1>,
): ContentAgentCapabilityAdapterV1 {
  return Object.freeze({
    capability: 'editorial.plan',
    contractRevision: CONTENT_AGENT_EDITORIAL_PLAN_ADAPTER_REVISION,
    async execute(request): Promise<ContentAgentAdapterResultV1> {
      const input = inputs.get(request.inputRef);
      if (!input) throw new ExistingCapabilityAdapterInvariantError(`editorial.plan input ${request.inputRef} was not resolved`);
      if (!input.evidenceRef.trim()) throw new ExistingCapabilityAdapterInvariantError('editorial.plan evidenceRef is required');

      const plan = executeEditorialBrainPlanningV1(input.request, input.policy, input.styleProfile);
      return Object.freeze({
        capability: 'editorial.plan',
        contractRevision: CONTENT_AGENT_EDITORIAL_PLAN_ADAPTER_REVISION,
        outputRef: `editorial-plan:${plan.revisionId}`,
        evidenceRef: input.evidenceRef,
      });
    },
  });
}

function createFinalValidationAdapter(
  inputs: ReadonlyMap<string, ExistingFinalValidationInputV1>,
): ContentAgentCapabilityAdapterV1 {
  return Object.freeze({
    capability: 'final.validate',
    contractRevision: CONTENT_AGENT_FINAL_VALIDATE_ADAPTER_REVISION,
    async execute(request): Promise<ContentAgentAdapterResultV1> {
      const input = inputs.get(request.inputRef);
      if (!input) throw new ExistingCapabilityAdapterInvariantError(`final.validate input ${request.inputRef} was not resolved`);
      if (!input.evidenceRef.trim()) throw new ExistingCapabilityAdapterInvariantError('final.validate evidenceRef is required');

      const validation = validateFinalDeliveryAgainstProfileV1(input.profile, input.measurement);
      if (!validation.valid) {
        throw new ExistingCapabilityAdapterInvariantError(`existing final delivery validator rejected measurement: ${validation.errors.join('; ')}`);
      }
      return Object.freeze({
        capability: 'final.validate',
        contractRevision: CONTENT_AGENT_FINAL_VALIDATE_ADAPTER_REVISION,
        outputRef: `final-delivery-valid:${input.profile.profileId}:${input.profile.profileVersion}`,
        evidenceRef: input.evidenceRef,
      });
    },
  });
}
