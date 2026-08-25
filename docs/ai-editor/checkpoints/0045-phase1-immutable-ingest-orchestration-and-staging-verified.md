# Checkpoint 0045 — Phase 1 immutable-ingest orchestration and pre-durable staging verified

Date: 2026-08-25 (Asia/Bangkok)

Starting HEAD: `9fc35f46157b845fa6bfdaf18231cca22892dd49`.

## Audit

This continuation re-read `PROJECT_BIBLE.md`, `docs/ai-editor/progress.json`, `docs/ai-editor/PROGRESS.md`, `docs/ai-editor/IMPLEMENTATION_MAPPING.md`, checkpoint 0044, exact `main` HEAD and exact CI status before new code.

The prior P1-08 implementation had already been repaired on `9fc35f46157b845fa6bfdaf18231cca22892dd49`. Exact status was `ai-editor-ci/all = success`, run `32809327532`, job `97685529112`. Therefore P1-08 can now be recorded verified. The prior documentation closure had been blocked by a connector write classification, so this checkpoint closes that evidence gap rather than pretending the docs were already current.

## P1-08 closure — end-to-end immutable local ingest orchestration

Implementation `79e4b427d474a9edbe4120d150bea1a61b89d940` added `packages/media-catalog/src/immutable-ingest.ts` and deterministic tests. The coordinator delegates to the existing verified primitives in this order:

1. confined local source ingest/content identity;
2. verified managed content-addressed original materialization;
3. bounded shell-free ffprobe against the managed original;
4. normalized native-PTS/rational-time-base stream persistence.

CI run `32809256441` failed at strict TypeScript because `chunkSize?: number` was forwarded as an explicit `undefined` under `exactOptionalPropertyTypes`. That run was not rerun unchanged. Repair `9fc35f46157b845fa6bfdaf18231cca22892dd49` conditionally omits the optional property. Repaired CI run `32809327532`, job `97685529112`, passed all normal gates.

## P1-09 — validated ingest before durable commit

A repository-level design gap remained: the verified `MediaCatalogPersistence` primitive path is synchronous/in-memory while `PostgresMediaCatalog` is genuinely async. Forcing the existing coordinator directly onto PostgreSQL would either require a destructive persistence-interface rewrite or risk partial durable writes across independent calls.

The smallest additive dependency-correct slice is therefore an explicit pre-durable staging boundary.

Implementation commit `71bd875abcd4b8eef6102f75159f71000955c3c5` adds:

- `packages/media-catalog/src/durable-ingest.ts`
- `packages/media-catalog/src/durable-ingest.test.ts`

The new boundary:

- runs the already verified P1-08 coordinator against isolated `InMemoryMediaCatalog` staging;
- performs source hashing, managed-original verification and ffprobe/native timing validation before any durable callback is possible;
- creates one `ValidatedImmutableIngestBundle` containing the immutable asset, source location, managed location and normalized native stream metadata;
- invokes one async `DurableImmutableIngestPersistence.commitValidatedImmutableIngest(...)` boundary only after complete deterministic validation;
- gives durable persistence defensive copies so mutation cannot alter the validated return value;
- does not claim PostgreSQL atomicity yet.

Tests verify successful single aggregate handoff, malformed native timing causing zero durable invocations, and defensive-copy isolation.

## Validation

The execution container still cannot resolve `github.com`, so no local clone/test pass is claimed. The code change was batched into one Git tree and one commit before moving `main`.

Exactly one normal CI run was used for P1-09:

- AI Editor CI run `32810880801`
- job `97689838481`
- exact SHA `71bd875abcd4b8eef6102f75159f71000955c3c5`
- dependency install: success
- strict TypeScript: success
- Vitest behavioral gate: success
- deterministic migration gate: success
- contract/policy gates: success
- observable status publication: success

No PostgreSQL/Qdrant local-stack run, FFmpeg integration run, matrix or rerun was triggered for this contract/staging-only slice.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time authority, renderer-neutral v2 adapter boundary, style/delivery/provenance/model contracts, immutable revision/render evidence, PostgreSQL migration 0002 semantics and FFmpeg `-copyts` behavior remain unchanged.

Stable asset identity remains SHA-256 byte-derived and independent from mutable locations. Native integer PTS plus rational stream time base remain the only source-timing authority. Decimal seconds remain derived/non-authoritative.

## Progress

```text
Standalone verified: 31 / 162 = 19.14%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:      9 / 14  = 64.29%
```

## Next task

Implement PostgreSQL-backed `commitValidatedImmutableIngest` as a single transaction for the validated aggregate. It must idempotently register/reuse the immutable asset, rebind source and managed locations, replace normalized native stream metadata, and commit or roll back the aggregate together. Reuse migration 0002 and existing validators. After static CI passes, run the selective PostgreSQL local-stack verifier once for real all-or-nothing runtime evidence; do not trigger unrelated heavyweight media workflows.
