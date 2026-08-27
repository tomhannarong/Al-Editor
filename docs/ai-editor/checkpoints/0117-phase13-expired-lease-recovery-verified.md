# Checkpoint 0117 — Phase-13 expired lease recovery verified

## Starting authority

- Bible revision: `1.2-standalone-ai-editor`.
- Starting main HEAD: `a95875cda01d52298173a142d4feb4923f7ee762`.
- Starting verified count: `101 / 162 = 62.35%`.
- Starting task: P13-02 — expired/stale lease recovery semantics and deterministic recovery drill.
- Phase-10 blocker remains external-only: real DaVinci Resolve import/relink/re-export proof.

## Local-first validation state

A local clone/test was attempted before using Actions, but this execution environment still could not resolve `github.com`. No local pass was claimed and DNS unavailability was not treated as a code failure.

## P13-02 implementation

Implementation commit `92193b0fb8f3d553721efd95bb13d00765f50d59` updates `packages/contracts/src/job-state-machine.contract.ts` additively while preserving `DurableJobV1` shape and `stateMachineVersion = 1.0`.

New command: `recover-expired`.

Exact semantics:

1. Only persisted `leased` or `running` jobs may enter recovery.
2. A lease cannot be recovered before its exact `expiresAt` instant.
3. Recovery clears lease owner/token evidence atomically.
4. Recovery itself does not increment `attempt`; a subsequent new lease does.
5. If `attempt < maxAttempts`, recovery returns the job to `queued` with stable error code `LEASE_EXPIRED`.
6. If `attempt >= maxAttempts`, recovery fails closed to terminal `failed` with `LEASE_EXPIRED_MAX_ATTEMPTS`.
7. Terminal/non-leased jobs cannot use this transition.
8. After recovery, the stale lease token cannot start, heartbeat, succeed or fail the job because no active lease exists.

The existing job-state tests were extended to cover active-lease rejection, queued recovery, running recovery, stale-token fencing, terminal/non-leased rejection and exhausted-attempt behavior.

## Deterministic recovery drill

Commit `22ba7627a4c6748bf9957f56cdfa5246fd709984` adds `packages/contracts/src/job-state-machine.recovery-drill.test.ts`.

The drill executes the complete abandoned-worker scenario:

`queued -> old lease -> running -> lease expiry -> recover-expired -> queued -> stale token rejected -> fresh lease -> running -> succeeded`.

It proves job identity/idempotency remain stable, recovery does not invent an attempt, the new lease advances the attempt, and stale worker authority is fenced before final success.

## CI evidence and Actions discipline

The initial implementation run `33127808551` was automatically cancelled by the repository concurrency group when the focused recovery-drill commit superseded it. This is not recorded as a code failure and the unchanged cancelled run was not rerun.

Final confidence evidence is exact SHA `22ba7627a4c6748bf9957f56cdfa5246fd709984`:

- AI Editor CI run: `33127847165`;
- job: `98710140160`;
- dependency install: success;
- strict TypeScript: success;
- Vitest: `72` files / `390` tests passed;
- durable job contract tests: `12` passed;
- deterministic recovery drill: `1` passed;
- migration deterministic gate: success;
- contract/policy gates: success;
- exact `ai-editor-ci/all = success`.

No matrix and no PostgreSQL/Qdrant/FFmpeg heavyweight workflow was used. The single final run reused the existing consolidated one-job CI design and concurrency cancellation behavior.

## Preserved contracts

No canonical timeline, media-time, renderer, delivery/style/profile, provenance, immutable revision, retrieval/editorial, human-review or Content Agent contract was changed. Durable job v1 persisted shape remains compatible; recovery is an additive command/transition only.

## Progress

- Standalone verified: `102 / 162 = 62.96%`.
- Phase 10: 3 verified slices; exact real Resolve gate remains open.
- Phase 11: verified-complete.
- Phase 12: verified-complete.
- Phase 13: 2 verified slices; gate remains open.

## Remaining Phase-13 gaps

1. versioned backup/restore ownership + RPO/RTO + clean-target restore drill;
2. versioned quota/admission policy + deterministic evaluator;
3. versioned SLO/cost-budget policy + deterministic evaluator.

## Next task

P13-03 — define the smallest versioned backup/restore contract with explicit restore owner, PostgreSQL/Qdrant durable-state scope, RPO/RTO, integrity/checksum evidence and clean-target restore requirements, then execute only the selective real restore proof required by the Phase-13 gate.
