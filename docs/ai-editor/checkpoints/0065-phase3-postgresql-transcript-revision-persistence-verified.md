# Checkpoint 0065 — Phase 3 PostgreSQL transcript revision persistence verified

Date: 2026-08-26 (Asia/Bangkok)

Starting HEAD: `37b8a334af8b02df1f78338e8e23161ba3930b90`.
Implementation commit: `e01b981876af149332304fe4cfd59b4f78b9a5f5`.

## Required startup audit

This run re-read `PROJECT_BIBLE.md`, `docs/ai-editor/progress.json`, `docs/ai-editor/PROGRESS.md`, `docs/ai-editor/IMPLEMENTATION_MAPPING.md`, checkpoint 0064, exact `main` HEAD and available CI evidence before changing code.

P3-02 was verified complete on `92037f27e0a5180e1706fc405d3ff7ecc5e8a148`, with AI Editor CI `32914047941` successful. No dependent gate was failed, so P3-03 was eligible as the smallest unfinished Phase-3 slice.

## Selected slice

P3-03 — PostgreSQL durable transcript revision persistence/readback.

## Implementation

Added in one batched implementation commit:

- `db/migrations/0006_create_transcript_library.sql`
- `packages/transcript-library/src/postgres.ts`
- `packages/transcript-library/src/postgres.test.ts`
- `infra/verify-postgres-transcript-library-runtime.mts`
- consolidated transcript verification into `.github/workflows/local-stack-gate.yml`

The database constrains transcript source lineage to an exact persisted **audio** stream tuple: asset identity, stream identity/index, rational time-base numerator/denominator and stream kind. This prevents durable transcript evidence from silently pointing at a different source stream or mismatched time base.

Correction lineage is additive and immutable. A correction parent must belong to the same transcript and exact source tuple. Root ASR revisions cannot have a parent, and correction revisions require a distinct parent revision ID.

Ordered transcript words persist native integer `source_start_pts` / `source_end_pts`, text, stable word identity/ordinal and optional bounded confidence. There are no seconds/milliseconds canonical timing columns.

The store validates before mutation, normalizes equivalent rational time bases, performs transactional insert/readback, treats semantic re-registration as idempotent, and rolls back conflicting reuse of an immutable revision ID.

## Validation evidence

AI Editor CI run `32917035651`, job `98022790043`, on exact SHA `e01b981876af149332304fe4cfd59b4f78b9a5f5`:

- install dependencies: success
- TypeScript strict gate: success
- Vitest behavioral gate: success
- migration deterministic gate: success
- contract/policy gates: success
- observable commit status: `ai-editor-ci/all = success`

AI Editor Local Stack Gate run `32917035721`, job `98022789688`, on the same exact SHA:

- deterministic verifier control flow: success
- API health contract: success
- Docker runtime: success
- PostgreSQL + Qdrant boot/health: success
- PostgreSQL media catalog/durable ingest/scene/proxy/keyframe/transcript runtime: success
- existing real FFmpeg proxy/keyframe generation regression: success
- API health against real dependencies: success
- cleanup: success
- observable commit status: `ai-editor-local-stack/all = success`

No matrix was added. The transcript verifier was consolidated into the existing single local-stack persistence job. No unchanged failed job was rerun.

## Preserved contracts

Canonical timeline v1/v2 compatibility, media-time rules, renderer-neutral v2 adapter boundary, style profile, delivery profile, structured logging, provenance/rights work, immutable revision/render evidence, Phase-1 media durability, and Phase-2 scene/proxy/keyframe lineage remain unchanged.

Transcript/model evidence remains untrusted data. Native source PTS + rational stream time base remain timing authority. Corrections remain additive immutable evidence.

## Progress

```text
Standalone verified: 50 / 162 = 30.86%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:     14 / 14  = 100.00%
Phase 2 verified:     11 / 11  = 100.00% + gate evidence
Phase 3 verified:      3 / 9   =  33.33%
```

## Failures / blockers

No correctness gate failed in this slice. No unavailable runner was counted as success or code failure. No unchanged failed job was rerun.

## Next task

P3-04 — versioned editorial segment contract over an immutable transcript revision. Segment boundaries should reference stable transcript word IDs/native word timing rather than introducing a second timing authority; persistence/runtime proof remains a later slice.
