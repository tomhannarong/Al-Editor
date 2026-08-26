# Checkpoint 0068 — Phase 3 PostgreSQL editorial segment revision persistence verified

## Scope

Closed P3-06: durable PostgreSQL editorial segment revision persistence/readback on `main` while preserving immutable transcript lineage, stable word-boundary references and the existing native-PTS/rational-time-base authority.

## Starting state

- Starting `main` HEAD: `639619f70575c21ec86e0b702b249a58bafedb70`
- Previous verified slice: P3-05 immutable editorial segment revision persistence/idempotency
- No failed dependency blocked P3-06.

## Implementation

Implementation commit: `695e5105e6bb124d99857d8770e898ac813aa264`

Added:

- `db/migrations/0007_create_editorial_segment_library.sql`
- `packages/editorial-segment-library/src/postgres.ts`
- `packages/editorial-segment-library/src/postgres.test.ts`
- `infra/verify-postgres-editorial-segment-library-runtime.mts`
- extension of the existing single-job `local-stack-gate.yml` runtime verifier list

Durable invariants:

- each editorial revision binds to the exact `transcriptId` + `transcriptRevisionId`;
- each segment boundary references stable transcript word IDs from that same immutable transcript revision through PostgreSQL foreign keys;
- exact semantic re-registration is idempotent;
- conflicting immutable `revisionId` reuse fails closed and rolls back;
- missing transcript word references fail closed;
- ordered durable readback preserves segment ordinal and word-boundary evidence;
- editorial-segment tables contain no duplicate PTS/seconds/milliseconds timing authority.

## Static validation

AI Editor CI run `32928880002`, job `98057124865`, on exact implementation SHA `695e5105e6bb124d99857d8770e898ac813aa264`:

- dependency install: success
- TypeScript strict: success
- Vitest: success
- deterministic migrations: success
- contract/policy gates: success
- observable status publication: success

Conclusion: `success`.

## First selective runtime result — failed gate retained as evidence

AI Editor Local Stack Gate run `32928879417`, job `98057123430`, on implementation SHA `695e5105e6bb124d99857d8770e898ac813aa264` failed in the combined PostgreSQL verifier step.

PostgreSQL, Qdrant and the earlier media/durable-ingest/scene/proxy/keyframe/transcript runtime verifiers all passed first. The new editorial verifier then attempted to reuse asset digest `c…c`, already used by the scene runtime fixture. `PostgresMediaCatalog.replaceStreamMetadata()` correctly attempted stream replacement and PostgreSQL rejected deletion of a stream still referenced by `scene_set_revisions_source_stream_fk`.

Classification: verifier fixture identity collision. This was not treated as a code pass, database pass, or unavailable-runner condition. FFmpeg derivative/API steps were skipped by the failed gate. The unchanged SHA was not rerun.

## Repair and final selective runtime evidence

Repair commit: `f5b8fba375272a2ed69a06a2e6cadb9125e9516c`

Change: isolate the editorial runtime fixture with a unique media digest. No package, migration or canonical contract changed.

AI Editor Local Stack Gate run `32929033073`, job `98057560645`, on exact repair SHA:

- deterministic verifier control flow: success
- API health contract static check: success
- Docker runtime: success
- PostgreSQL + Qdrant boot/health: success
- FFmpeg/ffprobe runtime tools: success
- PostgreSQL verifier dependencies: success
- media, durable-ingest, scene, proxy, keyframe, transcript and editorial-segment PostgreSQL runtime: success
- real FFmpeg proxy/keyframe derivative regression: success
- API health against real dependencies: success
- cleanup: success
- observable status: `ai-editor-local-stack/all = success`

No redundant normal CI run was triggered for the verifier-only repair.

## Progress

```text
Standalone verified: 53 / 162 = 32.72%
Phase 0:             22 / 22  = 100.00%
Phase 1:             14 / 14  = 100.00%
Phase 2:             11 / 11  = 100.00%
Phase 3:              6 / 9   =  66.67%
```

## Blockers

None for P3-06. The failed first runtime attempt was repaired and the exact repaired runtime gate is green.

## Next task

P3-07: audit remaining Phase-3 Bible gate evidence before naming the next implementation capability. Specifically reconcile the Bible requirements for immutable ASR/corrections, stable word timing and editorial segments against exact standalone evidence, then select the smallest genuinely missing independent slice. Do not invent checklist authority or spend an Actions run solely for redundant evidence.
