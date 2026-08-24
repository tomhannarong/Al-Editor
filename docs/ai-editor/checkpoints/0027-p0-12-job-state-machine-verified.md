# Checkpoint 0027 — P0-12 Job state machine verified

Date: 2026-08-24 (Asia/Bangkok)

Starting HEAD: `c66d19a983a4043fdd9db45e64f74fafeb9dbc44`.

Implemented standalone durable job state machine with stable idempotency key, bounded attempts, token-bound leases, heartbeat/expiry semantics, retry scheduling and terminal states. State transitions fail closed on wrong/expired leases, backwards command time, illegal transitions and early retry.

Local evidence before commit:

```text
strict TypeScript compile: PASS
PASS: durable job state machine self-test succeeded (8 transition/lease cases)
```

Vitest tests cover lease attempt increment, token mismatch, expiry, retry-wait/requeue, max-attempt terminal failure, terminal immutability and invalid persisted state.

P0-12 is VERIFIED. Standalone progress becomes `11/162 = 6.79%`; Phase 0 becomes `11/22 = 50.00%`.

P0-03/P0-04 remain runtime-pending; P0-05 remains directly blocked. Next independent item: P0-13 Structured logging convention.
