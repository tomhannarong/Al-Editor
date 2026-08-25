# AI Local Footage Editor — Progress

**Repository:** `tomhannarong/Al-Editor` / `main`  
**Phase:** 2 — Scene Library, Proxies, Keyframes  
**Current task:** audit the smallest rebuildable/versioned proxy derivative contract now that durable scene-set source mapping is verified

```text
Standalone verified: 39 / 162 = 24.07%
Phase 0:             22 / 22  = 100.00% COMPLETE
Phase 1:             14 / 14  = 100.00% COMPLETE
Phase 2:              3 / 11  =  27.27% verified
```

Phase 0 remains verified: P0-01 through P0-22. Phase 1 remains verified-complete: P1-01 through P1-14.

## Phase 2 verified slices

### P2-01 — versioned scene-set identity and exact source-mapping contract

Implementation `8759bc0437d672f4e63329fcc19b84172b9e433d`; AI Editor CI run `32840639465`, job `97779125483`, success. Scene sets bind immutable SHA-256 asset/stream identity to safe-integer native PTS + rational time base; derivative paths and decimal time remain non-authoritative.

### P2-02 — immutable scene-set revision persistence and idempotency

Implementation `c877b5e91f190ba490a1b6767759b4ff69268e02`, repaired by `e221be705e2dbd69e14df5dbbca7b5b949f17c29`; AI Editor CI run `32845521695`, job `97794189378`, success. Semantic re-registration is idempotent; conflicting `revisionId` reuse fails closed; new revisions are additive and stored evidence is defensively copied.

### P2-03 — PostgreSQL durable scene-set revision persistence/readback

Implementation commit `5c91fa9a4acf2ea23b198d3027142109d04cd630` adds:

- `db/migrations/0003_create_scene_library.sql`
- `packages/scene-library/src/postgres.ts`
- `packages/scene-library/src/postgres.test.ts`
- `infra/verify-postgres-scene-library-runtime.mts`
- selective local-stack integration

Migration 0003 persists immutable scene-set revisions and ordered scene intervals. Durable source mapping references the existing media stream tuple `(asset_id, stream_id, stream_index)` and stores only native PTS plus rational time-base integers as source authority.

Normal CI passed on the implementation commit: **run `32852840324`, job `97817616436`, `ai-editor-ci/all = success`**. Install, strict TypeScript, Vitest, deterministic migrations, contract/policy gates and observable status all passed.

The first selective PostgreSQL run `32852840321`, job `97817616179`, failed because the new scene-library verifier reapplied all migrations after the preceding media-catalog verifier had already applied `0001..0003`, producing `relation "media_assets" already exists`. This was verifier control-flow duplication, not scene persistence semantics, and the unchanged failed run was not rerun.

Repair commit `7cf7b857bfef8585897f208f21cbbe50d723a34c` changes only the verifier to assert/reuse the already migrated schema. The new selective runtime run **`32853149558`, job `97818643421`** passed Docker, PostgreSQL/Qdrant health, existing media-catalog/durable-ingest runtime checks, scene-library PostgreSQL proof, API dependency health, cleanup and status publication. Exact repaired status: **`ai-editor-local-stack/all = success`**.

Real PostgreSQL proof covers first insert, normalized rational readback, exact idempotent re-registration, conflicting detector evidence rejection without mutation, one revision row + two ordered interval rows, and absence of seconds/milliseconds timing columns.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time authority, renderer-neutral v2 adapter boundary, style/delivery/provenance/model contracts, structured logging, immutable revision/render evidence, Phase-1 media durability and FFmpeg `-copyts` behavior remain unchanged.

Proxy/keyframe work is still downstream: no derivative URI or codec property can become source mapping authority. Scene-set durable evidence remains immutable asset/stream identity + native integer PTS + rational source time base.

## Validation / free-tier discipline

The execution container could not resolve `github.com`, so no local clone/test pass is claimed. Related code/migration/runtime work was batched into one substantive commit. That commit triggered the two distinct gates justified by the slice: normal CI for static/behavioral/migration checks and selective local-stack for real PostgreSQL proof. A real runtime verifier failure was repaired by code/config change; no unchanged run was rerun. The repair touched only the selective verifier, so it triggered only the local-stack gate and did not spend another normal CI run.

## Next task

Audit the smallest **rebuildable/versioned proxy derivative contract**. A proxy should reference an immutable scene-set revision and source stream mapping, carry an explicit derivative/toolchain profile version, and remain disposable/rebuildable. Do not let proxy duration/seconds/path become canonical source authority, and do not add heavyweight media generation until the derivative contract/persistence boundary is explicit.
