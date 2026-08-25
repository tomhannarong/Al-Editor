# Checkpoint 0046 — Phase 1 PostgreSQL atomic validated-ingest commit verified

Date: 2026-08-25 (Asia/Bangkok)

Starting HEAD: `72114c21de4be9f37bf231b4c1b03142e0534c31`.

## Audit

This continuation re-read `PROJECT_BIBLE.md`, `docs/ai-editor/progress.json`, `docs/ai-editor/PROGRESS.md`, `docs/ai-editor/IMPLEMENTATION_MAPPING.md`, checkpoint 0045, the exact `main` HEAD and prior CI evidence before modifying code.

P1-09 was complete and validated: implementation `71bd875abcd4b8eef6102f75159f71000955c3c5`, AI Editor CI run `32810880801`, job `97689838481`, exact `ai-editor-ci/all = success`. The current progress authority explicitly selected PostgreSQL atomic commit of the validated ingest bundle as the next dependent slice.

## P1-10 — PostgreSQL atomic validated-ingest commit

Implementation commit `f7f90f8ef48d6fb551de218e100ad8f1bf0f809e` (`feat: add PostgreSQL ingest transaction`) changes:

- `packages/media-catalog/src/postgres.ts`
- `packages/media-catalog/src/postgres.test.ts`
- `infra/verify-postgres-media-catalog-runtime.mts`

`PostgresMediaCatalog.commitValidatedImmutableIngest(...)` now validates the complete aggregate before opening a transaction, then:

1. begins one PostgreSQL transaction;
2. inserts the immutable content-addressed asset with `ON CONFLICT DO NOTHING`;
3. when the asset already exists, locks and verifies its immutable byte identity inside the transaction;
4. upserts the source location;
5. upserts the managed content-addressed location;
6. replaces normalized native stream metadata;
7. commits only after every write succeeds;
8. rolls the transaction back on any error.

Bundle validation requires both mutable locations to reference the same immutable asset and to use distinct location IDs. Stream validation reuses the existing native integer PTS + rational time-base contract. No decimal seconds/milliseconds timing authority was added.

Deterministic tests verify the expected single-transaction query ordering, fail-closed pre-transaction bundle validation and rollback after a deliberately injected late stream insert error.

## Validation

The execution container still could not resolve `github.com`, so no local clone/test pass is claimed. The implementation, tests and real runtime verifier were assembled into one Git tree and pushed once, avoiding intermediate broken states.

### Normal CI

AI Editor CI run `32815455806`, job `97702665656`, exact SHA `f7f90f8ef48d6fb551de218e100ad8f1bf0f809e`:

- dependency install: success
- strict TypeScript: success
- Vitest behavioral gate: success
- deterministic migration gate: success
- contract/policy gates: success
- observable commit status publication: success
- exact status: **`ai-editor-ci/all = success`**

### Real PostgreSQL runtime proof

AI Editor Local Stack Gate run `32815455771`, job `97702665269`, exact SHA `f7f90f8ef48d6fb551de218e100ad8f1bf0f809e`:

- Docker runtime: success
- PostgreSQL healthy: success
- Qdrant HTTP health: success
- migration 0002 applied: success
- existing media-catalog round-trip checks: success
- atomic validated-ingest success readback: success
- injected late stream-write failure: rejected as expected
- post-rollback real PostgreSQL checks confirmed zero new asset row, zero source/managed location rows and zero stream rows for the failed bundle
- API health against real PostgreSQL + Qdrant: success
- cleanup: success
- exact status: **`ai-editor-local-stack/all = success`**

The runtime verifier emitted: `PostgreSQL media catalog runtime proof passed: migration 0002, idempotent identity, mutable rebinding, native PTS/time-base readback, and atomic validated-ingest commit/rollback.`

No unchanged failed workflow was rerun. No matrix or FFmpeg/media integration workflow was triggered. The local-stack workflow ran because the PostgreSQL runtime verifier itself changed and real transaction proof is the required evidence for this slice.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time authority, renderer-neutral v2 adapter boundary, style/delivery/provenance/model contracts, structured logging, immutable revision/render evidence and FFmpeg `-copyts` behavior remain unchanged.

Stable asset identity remains SHA-256 byte-derived and independent from storage URI. Native integer PTS plus rational stream time base remain source timing authority. The PostgreSQL transaction changes durable atomicity only; it does not introduce new media or timeline semantics.

## Progress

```text
Standalone verified: 32 / 162 = 19.75%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:     10 / 14  = 71.43%
```

## Next task

Audit the four remaining Phase-1 checklist items against the verified catalog/ingest implementation and select the smallest independent dependency-correct gap. The leading candidate is a thin durable filesystem-to-PostgreSQL composition proof using `ingestImmutableLocalMediaDurably(...)` with `PostgresMediaCatalog`, deterministic ffprobe injection and real PostgreSQL. Do not introduce new metadata semantics or begin Phase-2 derivative work until the remaining Phase-1 items are explicitly resolved and evidenced.
