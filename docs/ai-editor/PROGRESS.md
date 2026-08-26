# AI Local Footage Editor — Progress

**Repository:** `tomhannarong/Al-Editor` / `main`  
**Phase:** 3 — Voice / Transcript Alignment  
**Current task:** P3-04 — versioned editorial segment contract over immutable transcript word timing

```text
Standalone verified: 50 / 162 = 30.86%
Phase 0:             22 / 22  = 100.00% COMPLETE
Phase 1:             14 / 14  = 100.00% COMPLETE
Phase 2:             11 / 11  = 100.00% COMPLETE + GATE VERIFIED
Phase 3:              3 / 9   =  33.33%
```

Phase 0 remains verified-complete through P0-22. Phase 1 remains verified-complete through P1-14. Phase 2 remains verified-complete through P2-11 plus its exact quality-baseline gate evidence.

## Phase 3 — P3-03 verified

P3-03 adds durable PostgreSQL transcript revision persistence/readback in `packages/transcript-library/src/postgres.ts`, migration `0006_create_transcript_library.sql`, deterministic store tests and a selective real-PostgreSQL verifier.

The durable schema constrains every transcript revision to an exact persisted **audio** stream tuple: immutable asset identity, stream identity/index and normalized rational time base. Correction parent lineage is additionally constrained to the same transcript and exact source tuple, preventing a correction from silently pointing across media/source lineage.

Ordered words persist native integer `source_start_pts` / `source_end_pts` plus optional confidence only. No seconds or milliseconds timing columns were introduced. Equivalent rational time bases normalize before insert; exact semantic re-registration is idempotent; conflicting reuse of an immutable revision ID rolls back without replacing durable evidence.

### Validation evidence

Implementation commit `e01b981876af149332304fe4cfd59b4f78b9a5f5` was committed directly to `main` as one batched schema/store/test/runtime-verifier change.

AI Editor CI run `32917035651`, job `98022790043`:

- dependency install: success
- TypeScript strict gate: success
- Vitest behavioral gate: success
- migration deterministic gate: success
- contract/policy gates: success
- observable commit status: `ai-editor-ci/all = success`

AI Editor Local Stack Gate run `32917035721`, job `98022789688`:

- Docker runtime: success
- PostgreSQL + Qdrant boot/health: success
- media/durable-ingest/scene/proxy/keyframe/transcript PostgreSQL runtime verification: success
- existing real FFmpeg derivative regressions: success
- API dependency health: success
- observable commit status: `ai-editor-local-stack/all = success`

No unchanged failed job was rerun and no matrix was introduced. The transcript runtime verifier was consolidated into the existing single local-stack persistence step.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time authority, renderer-neutral v2 adapter boundary, style/delivery/provenance/model contracts, structured logging, immutable revision/render evidence, Phase-1 media durability and Phase-2 scene/proxy/keyframe evidence remain unchanged.

Transcript/model evidence remains untrusted data. Corrections remain additive immutable revisions rather than destructive rewrites. Native source PTS + rational stream time base remain authoritative.

## Next task

P3-04 — define a versioned editorial segment contract over immutable transcript revision/word IDs and native word timing. The segment layer must remain additive, must not duplicate ASR timing authority, and must preserve exact transcript revision lineage before any segment persistence or alignment runtime is introduced.
