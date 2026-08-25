# Checkpoint 0041 — Phase 1 PostgreSQL persistence runtime verified

Date: 2026-08-25 (Asia/Bangkok)

Starting HEAD: `5be2ae04080b3662e608e84c797726c84eedb94b`.

## Implementation and selective runtime gate

Commit `b31086c30d9c8a6e949e661363236226bfad015e` added `infra/verify-postgres-media-catalog-runtime.mts` and extended the existing local-stack workflow so the missing durability claim is exercised on a real PostgreSQL process. The verifier applies repository migrations including `0002_create_media_catalog.sql`, then executes `PostgresMediaCatalog` end-to-end for immutable asset registration, repeat registration preserving first-ingest evidence, mutable location rebinding, transactional stream replacement, native PTS/rational time-base readback, and absence of seconds/milliseconds timing columns.

Local cloning was attempted first but the execution environment still could not resolve `github.com`; no local pass is claimed.

## Failed gate and repair

Selective local-stack run `32793590693`, job `97640145419`, failed before Docker/runtime assertions at `actions/setup-node`. The workflow had requested npm caching but this repository has no `package-lock.json`. Runtime steps were skipped, so this run is not interpreted as a code or PostgreSQL failure and was not rerun unchanged.

Commit `303f01181aea935d0a87dd6472d48fcacbdce340` removed only the invalid cache input. That workflow configuration change is the reason for a new run.

## Exact runtime evidence

AI Editor Local Stack Gate run `32793644151`, job `97640306272`, completed successfully on exact commit `303f01181aea935d0a87dd6472d48fcacbdce340`.

Successful steps included:

- deterministic verifier control-flow test;
- API health contract test;
- Docker runtime verification;
- real PostgreSQL + Qdrant boot and health;
- PostgreSQL runtime verifier dependency install;
- **PostgreSQL media catalog round trip — success**;
- API health against the real dependencies;
- cleanup;
- observable status publication.

Combined status on the exact commit is `ai-editor-local-stack/all = success` targeting run `32793644151`.

P1-04 is now verified. The earlier normal CI evidence remains run `32788230358` on repaired implementation commit `7a93cb3...`; normal CI was deliberately not rerun because this run changed only the selective runtime verifier/workflow.

## Preserved contracts

No canonical timeline v1/v2, centralized media-time authority, renderer-neutral boundary, style/delivery/provenance/model contract, immutable revision/render evidence, or FFmpeg `-copyts` semantics changed. Native integer PTS plus rational stream time base remain the only durable source timing authority.

## Progress

```text
Standalone verified: 26 / 162 = 16.05%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:      4 / 14  = 28.57%
```

## Next task

Audit the remaining Phase-1 checklist against the current standalone implementation and select the smallest independent immutable-ingest item in phase order. Avoid duplicating stable identity, content-addressed ingest, normalized native metadata, or PostgreSQL durability capabilities already verified.
