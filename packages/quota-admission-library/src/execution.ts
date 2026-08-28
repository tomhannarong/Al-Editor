import {
  validateAiStageTelemetryV1,
  type AiEditorStage,
  type AiStageTelemetryV1,
} from '../../contracts/src/cost-performance-telemetry.contract.js';
import {
  validateDurableJobV1,
  type DurableJobV1,
} from '../../contracts/src/job-state-machine.contract.js';
import {
  validateQuotaAdmissionPolicyRevisionV1,
  type QuotaAdmissionPolicyRevisionV1,
} from '../../contracts/src/quota-admission-policy.contract.js';

export const QUOTA_ADMISSION_DECISION_SCHEMA_VERSION = '1.0' as const;

export type QuotaAdmissionViolationCodeV1 =
  | 'IN_FLIGHT_JOB_LIMIT'
  | 'ACTIVE_JOB_LIMIT'
  | 'STAGE_START_RATE_LIMIT'
  | 'INPUT_BYTES_LIMIT'
  | 'MEDIA_DURATION_LIMIT';

export interface ProjectJobEvidenceV1 {
  projectId: string;
  job: DurableJobV1;
}

export interface QuotaAdmissionRequestV1 {
  requestId: string;
  projectId: string;
  jobId: string;
  stage: AiEditorStage;
  requestedAt: string;
  estimatedInputBytes: number;
  estimatedMediaDurationMs: number;
}

export interface QuotaAdmissionEvidenceV1 {
  jobs: readonly ProjectJobEvidenceV1[];
  stageTelemetry: readonly AiStageTelemetryV1[];
}

export interface QuotaAdmissionUsageV1 {
  inFlightJobsBefore: number;
  inFlightJobsProspective: number;
  activeJobsBefore: number;
  activeJobsProspective: number;
  stageStartsInWindowBefore: number;
  stageStartsInWindowProspective: number;
  estimatedInputBytes: number;
  estimatedMediaDurationMs: number;
}

export interface QuotaAdmissionDecisionV1 {
  schemaVersion: typeof QUOTA_ADMISSION_DECISION_SCHEMA_VERSION;
  policyId: string;
  policyRevisionId: string;
  requestId: string;
  projectId: string;
  jobId: string;
  stage: AiEditorStage;
  admitted: boolean;
  violations: readonly QuotaAdmissionViolationCodeV1[];
  usage: QuotaAdmissionUsageV1;
}

export class QuotaAdmissionInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaAdmissionInvariantError';
  }
}

const IN_FLIGHT_STATES = new Set(['queued', 'leased', 'running', 'retry-wait']);
const ACTIVE_STATES = new Set(['leased', 'running']);
const nonEmpty = (value: string): boolean => value.trim().length > 0;
const nonNegativeSafeInteger = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;

/**
 * Deterministic Phase-13 quota admission evaluator.
 *
 * This boundary consumes validated durable-job and telemetry evidence only.
 * It does not mutate jobs, schedule work, change canonical media/timeline time,
 * or reinterpret telemetry as correctness authority.
 */
export function evaluateQuotaAdmissionV1(
  policy: QuotaAdmissionPolicyRevisionV1,
  request: QuotaAdmissionRequestV1,
  evidence: QuotaAdmissionEvidenceV1,
): QuotaAdmissionDecisionV1 {
  const policyValidation = validateQuotaAdmissionPolicyRevisionV1(policy);
  if (!policyValidation.valid) {
    throw new QuotaAdmissionInvariantError(`invalid quota admission policy: ${policyValidation.errors.join('; ')}`);
  }
  validateRequest(policy, request);

  const requestTime = Date.parse(request.requestedAt);
  const windowStart = requestTime - policy.limits.stageStartWindowSeconds * 1000;
  const seenJobIds = new Set<string>();
  let inFlightJobsBefore = 0;
  let activeJobsBefore = 0;
  let requestJobIsInFlight = false;
  let requestJobIsActive = false;

  for (const entry of evidence.jobs) {
    if (!nonEmpty(entry.projectId)) throw new QuotaAdmissionInvariantError('job evidence projectId is required');
    const jobErrors = validateDurableJobV1(entry.job);
    if (jobErrors.length > 0) {
      throw new QuotaAdmissionInvariantError(`invalid durable job evidence ${entry.job.jobId}: ${jobErrors.join('; ')}`);
    }
    if (seenJobIds.has(entry.job.jobId)) {
      throw new QuotaAdmissionInvariantError(`duplicate durable job evidence ${entry.job.jobId}`);
    }
    seenJobIds.add(entry.job.jobId);
    if (entry.projectId !== request.projectId) continue;

    const inFlight = IN_FLIGHT_STATES.has(entry.job.state);
    const active = ACTIVE_STATES.has(entry.job.state);
    if (inFlight) inFlightJobsBefore += 1;
    if (active) activeJobsBefore += 1;
    if (entry.job.jobId === request.jobId) {
      requestJobIsInFlight = inFlight;
      requestJobIsActive = active;
    }
  }

  let stageStartsInWindowBefore = 0;
  const seenStageRunIds = new Set<string>();
  for (const event of evidence.stageTelemetry) {
    const validation = validateAiStageTelemetryV1(event);
    if (!validation.valid) {
      throw new QuotaAdmissionInvariantError(`invalid stage telemetry ${event.stageRunId}: ${validation.errors.join('; ')}`);
    }
    if (seenStageRunIds.has(event.stageRunId)) {
      throw new QuotaAdmissionInvariantError(`duplicate stage telemetry ${event.stageRunId}`);
    }
    seenStageRunIds.add(event.stageRunId);

    const startedAt = Date.parse(event.startedAt);
    if (startedAt > requestTime) {
      throw new QuotaAdmissionInvariantError(`stage telemetry ${event.stageRunId} starts after requestedAt`);
    }
    if (
      event.correlation.projectId === request.projectId
      && event.stage === request.stage
      && startedAt >= windowStart
    ) {
      stageStartsInWindowBefore += 1;
    }
  }

  const inFlightJobsProspective = inFlightJobsBefore + (requestJobIsInFlight ? 0 : 1);
  const activeJobsProspective = activeJobsBefore + (requestJobIsActive ? 0 : 1);
  const stageStartsInWindowProspective = stageStartsInWindowBefore + 1;
  const violations: QuotaAdmissionViolationCodeV1[] = [];

  if (inFlightJobsProspective > policy.limits.maxInFlightJobsPerProject) violations.push('IN_FLIGHT_JOB_LIMIT');
  if (activeJobsProspective > policy.limits.maxActiveJobsPerProject) violations.push('ACTIVE_JOB_LIMIT');
  if (stageStartsInWindowProspective > policy.limits.maxStageStartsPerProjectPerWindow) violations.push('STAGE_START_RATE_LIMIT');
  if (request.estimatedInputBytes > policy.limits.maxEstimatedInputBytesPerAdmission) violations.push('INPUT_BYTES_LIMIT');
  if (request.estimatedMediaDurationMs > policy.limits.maxEstimatedMediaDurationMsPerAdmission) violations.push('MEDIA_DURATION_LIMIT');

  return Object.freeze({
    schemaVersion: QUOTA_ADMISSION_DECISION_SCHEMA_VERSION,
    policyId: policy.policyId,
    policyRevisionId: policy.revisionId,
    requestId: request.requestId,
    projectId: request.projectId,
    jobId: request.jobId,
    stage: request.stage,
    admitted: violations.length === 0,
    violations: Object.freeze(violations.slice()),
    usage: Object.freeze({
      inFlightJobsBefore,
      inFlightJobsProspective,
      activeJobsBefore,
      activeJobsProspective,
      stageStartsInWindowBefore,
      stageStartsInWindowProspective,
      estimatedInputBytes: request.estimatedInputBytes,
      estimatedMediaDurationMs: request.estimatedMediaDurationMs,
    }),
  });
}

function validateRequest(policy: QuotaAdmissionPolicyRevisionV1, request: QuotaAdmissionRequestV1): void {
  if (!nonEmpty(request.requestId)) throw new QuotaAdmissionInvariantError('requestId is required');
  if (!nonEmpty(request.projectId)) throw new QuotaAdmissionInvariantError('projectId is required');
  if (!nonEmpty(request.jobId)) throw new QuotaAdmissionInvariantError('jobId is required');
  if (!policy.stageScope.includes(request.stage)) throw new QuotaAdmissionInvariantError(`stage ${request.stage} is outside policy scope`);
  if (!Number.isFinite(Date.parse(request.requestedAt))) throw new QuotaAdmissionInvariantError('requestedAt must be a valid timestamp');
  if (!nonNegativeSafeInteger(request.estimatedInputBytes)) throw new QuotaAdmissionInvariantError('estimatedInputBytes must be a non-negative safe integer');
  if (!nonNegativeSafeInteger(request.estimatedMediaDurationMs)) throw new QuotaAdmissionInvariantError('estimatedMediaDurationMs must be a non-negative safe integer');
}
