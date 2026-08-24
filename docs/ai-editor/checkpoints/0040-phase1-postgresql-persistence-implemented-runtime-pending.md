# Checkpoint 0040 — Phase 1 PostgreSQL persistence implemented; runtime proof pending

Date: 2026-08-25 (Asia/Bangkok)

Starting HEAD: `6194d5aac31b96e8a599e2b6723b50ec4823a995`.

## Implementation

Commit `d74ae15817958df9279dffa6fcf9313a2f456fee` added migration `0002_create_media_catalog.sql`, `PostgresMediaCatalog`, and deterministic PostgreSQL-adapter tests.

The schema separates immutable SHA-256 asset identity from mutable storage locations and stores stream timing only as native integer PTS plus rational numerator/denominator. Stream projection replacement is transactional and persisted bigint values are rejected on read if they exceed the JavaScript safe-integer domain.

## Failure and repair evidence

AI Editor CI run `32788146255`, job `97624192474`, failed at strict TypeScript. Exact compiler failures were TS2365 and TS2322 in `packages/media-catalog/src/postgres.ts` because a `string | number` persisted value had not been explicitly narrowed before numeric comparison/return. Vitest and migration gates were skipped; no pass is claimed for that commit and the failed job was not rerun unchanged.

Repair commit `7a93cb3fbf75a160d8b6de8456c4576c72bb3fdf` added the required `typeof parsed === 'number'` narrowing. This is a concrete code reason for a new CI run rather than a rerun.

Exact repaired CI run `32788230358`, validate job `97624440298`, completed successfully: dependency install, strict TypeScript, Vitest behavioral tests, deterministic migration gate, contract/policy gates, observable commit status, and cleanup all passed.

## Verification boundary

P1-04 is deliberately **not** counted verified yet. The current evidence proves TypeScript/behavioral SQL semantics and deterministic migration shape, but not an actual PostgreSQL round trip applying migration 0002 and executing the adapter. Durability claims require that real runtime proof.

No canonical timeline v1/v2, media-time authority, renderer-neutral boundary, style/delivery/provenance/model contract, immutable revision/render evidence, or FFmpeg `-copyts` semantics changed.

Local clone/test remained unavailable because the execution environment could not resolve `github.com`; that is neither a test pass nor a code failure.

## Progress

```text
Standalone verified: 25 / 162 = 15.43%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:      3 / 14  = 21.43%
P1-04: implemented + repaired CI pass; real PostgreSQL runtime pending
```

## Next task

Add the smallest real-PostgreSQL verifier for migration 0002 + `PostgresMediaCatalog`, then run it selectively once against the existing PostgreSQL local stack. Exercise idempotent asset registration, mutable location rebinding, transactional normalized-stream replacement, and native PTS/rational time-base readback. Only then mark P1-04 verified.
