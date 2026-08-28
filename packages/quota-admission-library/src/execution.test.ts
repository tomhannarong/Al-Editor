import { describe, expect, it } from 'vitest';
import {
  QUOTA_ADMISSION_POLICY_AUTHORITY,
  QUOTA_ADMISSION_POLICY_SCHEMA_VERSION,
  type QuotaAdmissionPolicyRevisionV1,
} from '../../contracts/src/quota-admission-policy.contract.js';
import type { AiStageTelemetryV1 } from '../../contracts/src/cost-performance-telemetry.contract.js';
import type { DurableJobV1 } from '../../contracts/src/job-state-machine.contract.js';
import {
  QuotaAdmissionInvariantError,
  evaluateQuotaAdmissionV1,
  type ProjectJobEvidenceV1,
  type QuotaAdmissionRequestV1,
} from './execution.js';

const PROJECT = 'project:phase13-fixture';
const NOW = '2026-08-28T02:00:00.000Z';

function policy(): QuotaAdmissionPolicyRevisionV1 {
  return {
    schemaVersion: QUOTA_ADMISSION_POLICY_SCHEMA_VERSION,
    authority: QUOTA_ADMISSION_POLICY_AUTHORITY,
    policyId: 'quota-admission:phase13',
    revisionId: 'quota-admission:phase13:r1',
    owner: 'platform-operations',
    stageScope: ['plan'],
    limits: {
      maxInFlightJobsPerProject: 3,
      maxActiveJobsPerProject: 2,
      stageStartWindowSeconds: 60,
      maxStageStartsPerProjectPerWindow: 2,
      maxEstimatedInputBytesPerAdmission: 1_000,
      maxEstimatedMediaDurationMsPerAdmission: 60_000,
    },
    createdAt: '2026-08-28T01:30:00.000Z',
  };
}

function request(overrides: Partial<QuotaAdmissionRequestV1> = {}): QuotaAdmissionRequestV1 {
  return {
    requestId: 'request:new-plan',
    projectId: PROJECT,
    jobId: 'job:new',
    stage: 'plan',
    requestedAt: NOW,
    estimatedInputBytes: 500,
    estimatedMediaDurationMs: 30_000,
    ...overrides,
  };
}

function job(jobId: string, state: DurableJobV1['state']): ProjectJobEvidenceV1 {
  const active = state === 'leased' || state === 'running';
  return {
    projectId: PROJECT,
    job: {
      stateMachineVersion: '1.0',
      jobId,
      jobType: 'editorial-plan',
      idempotencyKey: `idem:${jobId}`,
      state,
      attempt: active ? 1 : 0,
      maxAttempts: 3,
      lease: active ? {
        ownerId: 'worker:1',
        token: `token:${jobId}`,
        acquiredAt: '2026-08-28T01:59:00.000Z',
        heartbeatAt: '2026-08-28T01:59:10.000Z',
        expiresAt: '2026-08-28T02:01:00.000Z',
      } : null,
      nextAttemptAt: state === 'retry-wait' ? '2026-08-28T02:01:00.000Z' : null,
      lastErrorCode: null,
      createdAt: '2026-08-28T01:58:00.000Z',
      updatedAt: '2026-08-28T01:59:10.000Z',
    },
  };
}

function telemetry(stageRunId: string, startedAt: string, projectId = PROJECT): AiStageTelemetryV1 {
  return {
    schemaVersion: '1.0',
    authority: 'telemetry-only',
    stageRunId,
    stage: 'plan',
    outcome: 'succeeded',
    startedAt,
    completedAt: startedAt,
    correlation: { projectId },
    usage: { wallDurationMs: 0 },
  };
}

describe('Phase-13 quota admission evaluator', () => {
  it('admits a bounded request and reports prospective usage deterministically', () => {
    const decision = evaluateQuotaAdmissionV1(
      policy(),
      request(),
      { jobs: [job('job:queued', 'queued')], stageTelemetry: [telemetry('stage:old', '2026-08-28T01:58:00.000Z')] },
    );

    expect(decision.admitted).toBe(true);
    expect(decision.violations).toEqual([]);
    expect(decision.usage).toMatchObject({
      inFlightJobsBefore: 1,
      inFlightJobsProspective: 2,
      activeJobsBefore: 0,
      activeJobsProspective: 1,
      stageStartsInWindowBefore: 0,
      stageStartsInWindowProspective: 1,
    });
  });

  it('rejects quota excess across job, stage-rate, and per-admission resource dimensions', () => {
    const decision = evaluateQuotaAdmissionV1(
      policy(),
      request({ estimatedInputBytes: 1_001, estimatedMediaDurationMs: 60_001 }),
      {
        jobs: [job('job:running-1', 'running'), job('job:running-2', 'running'), job('job:queued', 'queued')],
        stageTelemetry: [
          telemetry('stage:1', '2026-08-28T01:59:10.000Z'),
          telemetry('stage:2', '2026-08-28T01:59:20.000Z'),
        ],
      },
    );

    expect(decision.admitted).toBe(false);
    expect(decision.violations).toEqual([
      'IN_FLIGHT_JOB_LIMIT',
      'ACTIVE_JOB_LIMIT',
      'STAGE_START_RATE_LIMIT',
      'INPUT_BYTES_LIMIT',
      'MEDIA_DURATION_LIMIT',
    ]);
  });

  it('does not double-count an already active request job and ignores other projects', () => {
    const existingRequest = job('job:new', 'running');
    const otherProject = job('job:other', 'running');
    otherProject.projectId = 'project:other';

    const decision = evaluateQuotaAdmissionV1(
      policy(),
      request(),
      {
        jobs: [existingRequest, otherProject],
        stageTelemetry: [telemetry('stage:other', '2026-08-28T01:59:30.000Z', 'project:other')],
      },
    );

    expect(decision.usage.inFlightJobsProspective).toBe(1);
    expect(decision.usage.activeJobsProspective).toBe(1);
    expect(decision.usage.stageStartsInWindowProspective).toBe(1);
    expect(decision.admitted).toBe(true);
  });

  it('fails closed on malformed or duplicate evidence', () => {
    const duplicate = job('job:duplicate', 'queued');
    expect(() => evaluateQuotaAdmissionV1(policy(), request(), { jobs: [duplicate, duplicate], stageTelemetry: [] }))
      .toThrow(QuotaAdmissionInvariantError);

    const future = telemetry('stage:future', '2026-08-28T02:00:01.000Z');
    expect(() => evaluateQuotaAdmissionV1(policy(), request(), { jobs: [], stageTelemetry: [future] }))
      .toThrow('starts after requestedAt');
  });

  it('fails closed when the request is outside the versioned policy scope', () => {
    expect(() => evaluateQuotaAdmissionV1(policy(), request({ stage: 'final-render' }), { jobs: [], stageTelemetry: [] }))
      .toThrow('outside policy scope');
  });
});
