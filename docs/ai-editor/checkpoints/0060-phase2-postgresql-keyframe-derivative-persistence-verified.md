# Checkpoint 0060 — Phase 2 PostgreSQL keyframe derivative persistence verified

Date: 2026-08-26 (Asia/Bangkok)

Starting HEAD: `1e23f95549b2b046d67cbbe7be0b11168208c9a6`.

## Required startup audit

This run re-read `PROJECT_BIBLE.md`, `docs/ai-editor/progress.json`, `docs/ai-editor/PROGRESS.md`, `docs/ai-editor/IMPLEMENTATION_MAPPING.md`, checkpoint 0059, exact `main` HEAD and available CI evidence before modifying code.

Starting progress was 45/162 standalone verified and Phase 2 was 9/11. P2-09 had exact `ai-editor-ci/all = success` evidence on implementation SHA `5ce040aeb14953f126cfe9dee8b22e086dd06775`. The smallest dependency-correct unfinished item was PostgreSQL durable keyframe derivative revision persistence/readback.

## Selected slice

P2-10 — **PostgreSQL durable keyframe derivative revision persistence/readback**.

Implementation commit: `bc8431dffaf8a5c2d682b779557b46f004508e92`.

## Implementation

- `db/migrations/0005_create_keyframe_library.sql`
  - adds immutable keyframe derivative revision rows;
  - constrains each revision to the exact persisted scene-set/source tuple already normalized by the scene library;
  - constrains `(scene_set_revision_id, scene_id)` to an existing scene interval;
  - stores ordered frame evidence with unique frame IDs and native `source_pts` per revision;
  - adds no seconds/milliseconds timing columns.
- `packages/keyframe-library/src/postgres.ts`
  - validates before `BEGIN`;
  - normalizes rational time base before durable write;
  - inserts revision + ordered frames transactionally;
  - treats exact semantic re-registration as idempotent;
  - rejects conflicting immutable evidence and rolls back;
  - reconstructs, validates and defensively copies readback evidence.
- `packages/keyframe-library/src/postgres.test.ts`
  - covers pre-transaction validation, normalized transactional insert, ordered frame writes, idempotent conflict handling and defensive readback.
- `infra/verify-postgres-keyframe-library-runtime.mts`
  - proves migration 0005 on real PostgreSQL;
  - creates exact media/scene lineage, persists keyframe revision/frame evidence, re-registers idempotently and rejects a conflicting artifact URI;
  - verifies durable row counts, ordered native PTS values, normalized rational time base and absence of seconds/milliseconds timing authority.
- `.github/workflows/local-stack-gate.yml`
  - adds the keyframe PostgreSQL verifier to the existing single local-stack job and retains concurrency cancellation/no matrix behavior.

## Validation

No unchanged failed workflow was rerun. Both required exact-SHA gates passed on first execution.

### AI Editor CI

- run `32892664602`
- job `97947954572`
- TypeScript strict gate: success
- Vitest behavioral gate: success
- migration deterministic gate: success
- contract and policy gates: success
- observable commit status: `ai-editor-ci/all = success`

### AI Editor Local Stack Gate

- run `32892664650`
- job `97947954495`
- deterministic verifier control flow: success
- API health contract: success
- Docker runtime: success
- PostgreSQL + Qdrant runtime: success
- PostgreSQL media catalog / durable ingest / scene / proxy / keyframe verifier chain: success
- real FFmpeg proxy-generation regression gate: success
- API health against real dependencies: success
- cleanup/status publication: success
- observable commit status: `ai-editor-local-stack/all = success`

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time rules, renderer-neutral v2 adapter boundary, style/delivery profiles, structured logging, provenance/rights work, immutable revision/render evidence, Phase-1 ingest durability and existing Phase-2 scene/proxy/keyframe source-lineage contracts remain unchanged.

Native source PTS + rational stream time base remain authoritative. Frame artifact URIs are rebuildable derivative state only.

## Progress

```text
Standalone verified: 46 / 162 = 28.40%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:     14 / 14  = 100.00%
Phase 2 verified:     10 / 11  =  90.91%
```

## Failures / blockers

No correctness blocker remains for P2-10. No failed gate was skipped. No unavailable runner was treated as a pass or code failure. No unchanged failed run was rerun.

## Next task

Implement the final Phase-2 slice: confined, shell-free, bounded real FFmpeg keyframe extraction from managed immutable originals. The extraction must preserve exact scene/source native-PTS lineage, treat image bytes/URIs as rebuildable derivative state only, and use a selective runtime proof. Then reconcile the Phase-2 gate before advancing to Phase 3.
