# Phase 13 Production Hardening Audit — P13-01

**Bible revision:** `1.2-standalone-ai-editor`  
**Audit starting HEAD:** `5d6771c110fbf8f45d305f11ccff6637d4eaecc5`  
**Phase gate:** recovery evidence; restore drill; quotas; cost/SLO evidence

## Existing verified foundations

### Durable job semantics

`packages/contracts/src/job-state-machine.contract.ts` already provides versioned durable job state, idempotency keys, bounded attempts, explicit leases/heartbeats, retry-wait, terminal failure and cancellation. This is useful recovery groundwork, but it is not yet complete production recovery evidence.

Exact gap: there is no explicit stale/expired lease reclamation command or deterministic recovery drill proving that an abandoned `leased`/`running` job can be safely reclaimed without violating attempt limits, idempotency identity or lease-token fencing.

### Durable storage and runtime evidence

The standalone repository already has real PostgreSQL and Qdrant runtime evidence for earlier phase-specific persistence paths, and `infra/docker-compose.yml` mounts durable PostgreSQL/Qdrant volumes. Multiple selective runtime verifiers prove actual database/vector-store round trips for migrated capabilities.

Exact gap: persistent volumes and round-trip tests are not a backup/restore program. There is no versioned backup manifest, restore ownership, RPO/RTO policy, integrity verification, or committed restore-drill evidence that recreates durable state into a clean target and verifies application-readable records.

### Cost/performance telemetry

`packages/contracts/src/cost-performance-telemetry.contract.ts` already records stage-level wall/cpu/gpu duration, byte/media/token usage, optional priced cost, pinned version references and stable failure codes under `telemetry-only` authority.

Exact gap: raw telemetry does not define production SLOs or admission limits. There is no versioned SLO/budget policy, no deterministic evaluation of observed telemetry against that policy, and no evidence tying service objectives to alert/error-budget semantics.

### Quotas / admission control

No verified standalone quota/admission policy was found in the audited production surfaces. Existing job `maxAttempts` is a retry bound, not a resource/user/workspace quota.

Exact gap: no versioned limits for concurrent jobs, queued jobs, ingest bytes, media duration, model/token spend, render concurrency or other bounded resource dimensions; no fail-closed quota evaluation evidence exists yet.

## Phase-13 gap matrix

| Gate area | Existing evidence | Missing proof | Smallest next implementation |
|---|---|---|---|
| Recovery | Durable job lease/heartbeat/retry/idempotency contract | stale lease reclamation + deterministic recovery drill | P13-02 add fenced expired-lease recovery semantics/tests |
| Restore | PostgreSQL/Qdrant durable runtime paths + persistent volumes | backup manifest, restore ownership, RPO/RTO, clean-target restore drill | P13-03 version backup/restore contract then selective real drill |
| Quotas | bounded job attempts only | resource/admission quota policy + evaluator | P13-04 version quota policy and deterministic admission gate |
| Cost/SLO | stage cost/performance telemetry v1 | SLO/budget policy + evaluator + evidence | P13-05 version SLO/cost budget policy and deterministic evaluation |

## Decisions

1. Phase 13 is **not production-ready** from the current evidence.
2. Existing Phase 0–12 correctness contracts remain untouched.
3. Do not use PostgreSQL/Qdrant/FFmpeg heavyweight Actions merely for this audit.
4. Implement recovery semantics before restore/quota/SLO work because it is the smallest independent missing production-hardening capability and builds directly on the already-versioned durable job contract.
5. A later Phase-13 reconciliation must require actual restore-drill evidence; static contracts alone cannot close that gate.

## Next task

P13-02 — add explicit, fenced expired-lease recovery to durable jobs and deterministic tests proving abandoned work can be reclaimed while active leases, terminal jobs, max-attempt exhaustion and stale tokens fail closed. Preserve state-machine v1 compatibility through additive command semantics rather than destructive job-shape changes.
