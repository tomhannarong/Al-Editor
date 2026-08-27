import { describe, expect, it } from 'vitest';
import { transitionDurableJobV1, type DurableJobV1 } from './job-state-machine.contract.js';

const initialJob = (): DurableJobV1 => ({
  stateMachineVersion: '1.0',
  jobId: 'job-recovery-drill',
  jobType: 'analyze-media',
  idempotencyKey: 'asset-recovery:analysis-v1',
  state: 'queued',
  attempt: 0,
  maxAttempts: 3,
  lease: null,
  nextAttemptAt: null,
  lastErrorCode: null,
  createdAt: '2026-08-28T00:00:00Z',
  updatedAt: '2026-08-28T00:00:00Z',
});

describe('expired lease recovery drill', () => {
  it('reclaims abandoned work, fences the stale worker, and completes under a fresh lease', () => {
    const firstLease = transitionDurableJobV1(initialJob(), {
      type: 'lease',
      ownerId: 'worker-old',
      token: 'token-old',
      now: '2026-08-28T00:01:00Z',
      leaseExpiresAt: '2026-08-28T00:03:00Z',
    });
    expect(firstLease.ok).toBe(true);

    const running = transitionDurableJobV1(firstLease.job, {
      type: 'start',
      token: 'token-old',
      now: '2026-08-28T00:01:30Z',
    });
    expect(running.ok).toBe(true);

    const recovered = transitionDurableJobV1(running.job, {
      type: 'recover-expired',
      now: '2026-08-28T00:03:00Z',
    });
    expect(recovered.ok).toBe(true);
    expect(recovered.job.state).toBe('queued');
    expect(recovered.job.attempt).toBe(1);
    expect(recovered.job.lease).toBeNull();

    const staleWorker = transitionDurableJobV1(recovered.job, {
      type: 'succeed',
      token: 'token-old',
      now: '2026-08-28T00:03:01Z',
    });
    expect(staleWorker.ok).toBe(false);

    const freshLease = transitionDurableJobV1(recovered.job, {
      type: 'lease',
      ownerId: 'worker-new',
      token: 'token-new',
      now: '2026-08-28T00:03:02Z',
      leaseExpiresAt: '2026-08-28T00:08:00Z',
    });
    expect(freshLease.ok).toBe(true);
    expect(freshLease.job.attempt).toBe(2);

    const restarted = transitionDurableJobV1(freshLease.job, {
      type: 'start',
      token: 'token-new',
      now: '2026-08-28T00:03:03Z',
    });
    expect(restarted.ok).toBe(true);

    const completed = transitionDurableJobV1(restarted.job, {
      type: 'succeed',
      token: 'token-new',
      now: '2026-08-28T00:04:00Z',
    });
    expect(completed.ok).toBe(true);
    expect(completed.job.state).toBe('succeeded');
    expect(completed.job.attempt).toBe(2);
    expect(completed.job.lease).toBeNull();
  });
});
