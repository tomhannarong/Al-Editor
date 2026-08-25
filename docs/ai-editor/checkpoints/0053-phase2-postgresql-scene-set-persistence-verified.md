# Checkpoint 0053 — Phase 2 PostgreSQL scene-set persistence verified

Date: 2026-08-25 (Asia/Bangkok)

Starting HEAD: `eeb256a8c6946d24cacb2e2b455724c839e1c101`.

## Required startup audit

This run re-read `PROJECT_BIBLE.md`, `docs/ai-editor/progress.json`, `docs/ai-editor/PROGRESS.md`, `docs/ai-editor/IMPLEMENTATION_MAPPING.md`, checkpoint 0052, exact `main` HEAD and available CI evidence before modifying code.

The starting HEAD was documentation-only and had no Actions run. P2-02 was verified with `ai-editor-ci/all = success` on repaired implementation `e221be705e2dbd69e14df5dbbca7b5b949f17c29`. The next dependency-correct Phase-2 gap was durable PostgreSQL persistence/readback for immutable scene-set revisions before proxy/keyframe derivatives.

Local cloning was attempted first but the execution container still could not resolve `github.com`; no local test pass is claimed.

## Selected slice

P2-03 — **PostgreSQL durable scene-set revision persistence/readback**.

Implementation commit:

`5c91fa9a4acf2ea23b198d3027142109d04cd630` — `feat: persist scene-set revisions in postgres`

Added:

- `db/migrations/0003_create_scene_library.sql`
- `packages/scene-library/src/postgres.ts`
- `packages/scene-library/src/postgres.test.ts`
- `infra/verify-postgres-scene-library-runtime.mts`
- selective integration in `.github/workflows/local-stack-gate.yml`

## Durable semantics

Migration 0003 adds:

- immutable `scene_set_revisions` keyed by `revision_id`;
- exact source asset/stream/index reference to the existing media stream tuple;
- positive rational source time-base numerator/denominator columns;
- ordered `scene_set_intervals` with native integer start/end PTS and positive span constraint;
- no seconds/milliseconds source timing columns.

`PostgresSceneSetRevisionStore` validates before transaction side effects, normalizes rational time bases without decimal conversion, inserts revision + ordered intervals transactionally, accepts exact semantic re-registration idempotently, rejects conflicting `revisionId` reuse and parses durable bigint values only within JavaScript safe-integer range.

## Validation

Normal CI on exact implementation `5c91fa9a...`:

- AI Editor CI run `32852840324`
- job `97817616436`
- install: success
- strict TypeScript: success
- Vitest: success
- deterministic migration gate: success
- contract/policy gates: success
- observable status: success
- exact `ai-editor-ci/all = success`

The same substantive commit intentionally triggered the selective real PostgreSQL gate because runtime durability is part of this slice.

First selective runtime:

- run `32852840321`
- job `97817616179`
- Docker/PostgreSQL/Qdrant boot: success
- existing media-catalog runtime: success
- durable real-media ingest runtime: success
- new scene-library verifier: failure before its scene assertions because it reapplied all migrations after the preceding media-catalog verifier had already applied `0001..0003`
- error: `relation "media_assets" already exists`
- API runtime was skipped after that failure

This was verifier orchestration duplication, not a scene persistence semantic failure. The failed run was not rerun unchanged.

Repair commit:

`7cf7b857bfef8585897f208f21cbbe50d723a34c` — `fix: reuse migrated scene-library runtime schema`

The repair changes only the scene-library runtime verifier: it asserts that migration 0003 tables already exist and reuses that schema instead of reapplying migrations.

Repaired selective runtime evidence:

- AI Editor Local Stack Gate run `32853149558`
- job `97818643421`
- deterministic verifier control-flow test: success
- API health contract test: success
- Docker runtime: success
- PostgreSQL + Qdrant boot/health: success
- FFmpeg runtime tools: success
- PostgreSQL runtime verifier dependencies: success
- media catalog + durable ingest + scene library runtime: success
- real API dependency health: success
- cleanup: success
- observable status publication: success
- exact repaired status: **`ai-editor-local-stack/all = success`**

Real PostgreSQL scene-library proof includes first durable insert, equivalent rational normalization/readback, exact idempotent re-registration, conflicting detector-version rejection without mutation, exactly one revision row + two ordered scene rows and no seconds/milliseconds timing columns.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time rules, renderer-neutral v2 adapter boundary, style/delivery/provenance/model contracts, structured logging, immutable timeline revision/render evidence, Phase-1 content-addressed media durability and FFmpeg `-copyts` behavior remain unchanged.

Scene-set source authority remains immutable asset/stream identity + native integer PTS + rational time base. Proxy and keyframe derivatives remain downstream and rebuildable; none were introduced in this slice.

## Free-tier discipline

Related code/migration/runtime work was batched into one substantive push. Two distinct gates were used because they prove different required properties: normal CI for static/behavioral/migration correctness and selective local-stack for real PostgreSQL durability. The verifier-only repair triggered only the selective workflow, not another normal CI run. No matrix or additional heavyweight media workflow was added.

## Progress

```text
Standalone verified: 39 / 162 = 24.07%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:     14 / 14  = 100.00%
Phase 2 verified:      3 / 11  =  27.27%
```

## Next task

Audit the smallest rebuildable/versioned proxy derivative contract. It should reference an immutable scene-set revision/source mapping and explicit derivative/toolchain profile version, while remaining disposable/rebuildable and non-authoritative for source timing. Avoid real proxy generation until that contract and persistence boundary are explicit.
