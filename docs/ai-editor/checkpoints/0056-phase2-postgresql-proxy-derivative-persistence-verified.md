# Checkpoint 0056 — Phase 2 PostgreSQL proxy derivative persistence verified

Date: 2026-08-25 (Asia/Bangkok)

Starting HEAD: `c62cbf47e8d7ceb3fb6460328e42c66734d4192d`.

## Required startup audit

This run re-read `PROJECT_BIBLE.md`, `docs/ai-editor/progress.json`, `docs/ai-editor/PROGRESS.md`, `docs/ai-editor/IMPLEMENTATION_MAPPING.md`, checkpoint 0055, exact `main` HEAD and available CI evidence before modifying code.

Starting progress was 41/162 standalone verified and Phase 2 was 5/11. P2-05 implementation `f950775fadea9b3681c4c7fdec93cb27b59f29f8` had exact `ai-editor-ci/all = success` from run `32863422284`; the docs-only starting HEAD introduced no newer substantive gate.

A local clone/test attempt was made first, but the execution environment could not resolve `github.com`. No local test pass is claimed from that environment. The smallest dependency-correct unfinished item remained the durable PostgreSQL proxy derivative revision persistence/readback boundary explicitly recorded as next in checkpoint 0055.

## Selected slice

P2-06 — **PostgreSQL durable proxy derivative revision persistence/readback**.

Implementation commit:

`577a14456b5b7c48860f52f88dd0ac6a11d2f380` — `feat: persist proxy derivative revisions in postgres`

Added/updated:

- `db/migrations/0004_create_proxy_library.sql`
- `packages/proxy-library/src/postgres.ts`
- `packages/proxy-library/src/postgres.test.ts`
- `infra/verify-postgres-proxy-library-runtime.mts`
- `.github/workflows/local-stack-gate.yml`

## Semantics

Migration 0004 creates `proxy_derivative_revisions` and constrains each row to the exact immutable scene-set/source tuple via a composite foreign key covering scene-set identity/revision, asset/stream/index and normalized rational time base.

`PostgresProxyDerivativeRevisionStore` validates and normalizes before opening a transaction. First registration is inserted once; exact semantic re-registration is idempotent; conflicting reuse of the same `revisionId` fails closed and rolls back. Durable readback reparses safe integers and normalizes the rational source time base before returning defensive evidence.

`artifactUri`, derivative profile and pinned toolchain remain rebuildable derivative evidence. They do not redefine canonical source identity or create proxy-time/seconds/milliseconds authority.

## Validation

The implementation was batched into one substantive commit. Two gates were justified for this database slice and both passed on the exact implementation SHA without reruns.

### Normal CI

- AI Editor CI run `32869312338`
- job `97872229894`
- exact SHA `577a14456b5b7c48860f52f88dd0ac6a11d2f380`
- install: success
- strict TypeScript: success
- Vitest: success
- deterministic migrations: success
- contract/policy gates: success
- observable status publication: success
- exact status: `ai-editor-ci/all = success`

### Selective real PostgreSQL runtime

- AI Editor Local Stack Gate run `32869312804`
- job `97872230411`
- PostgreSQL + Qdrant boot/health: success
- migration/runtime dependency setup: success
- media catalog + durable ingest + scene library + proxy library runtime verifier step: success
- API health against real dependencies: success
- cleanup/status publication: success
- exact status: `ai-editor-local-stack/all = success`

The proxy runtime proof confirmed migration 0004 exists, exact scene/source lineage is durable, equivalent rational `2/180000` normalizes to `1/90000`, exact re-registration is idempotent, conflicting immutable evidence is rejected without replacing the stored row, and no seconds/milliseconds timing columns are introduced.

No matrix, unchanged rerun or separate heavyweight proxy-generation job was used.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time rules, renderer-neutral v2 adapter boundary, style/delivery/provenance/model contracts, structured logging, immutable revision/render evidence, Phase-1 media durability, scene-set persistence and existing FFmpeg `-copyts` behavior remain unchanged.

No canonical contract was silently changed. Proxy derivatives remain versioned/rebuildable and downstream of immutable scene-set/source authority.

## Progress

```text
Standalone verified: 42 / 162 = 25.93%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:     14 / 14  = 100.00%
Phase 2 verified:      6 / 11  =  54.55%
```

## Failures / blockers

No correctness gate failed. The only local-environment limitation was DNS/network resolution for cloning GitHub, and no pass is claimed from that unavailable local route. Both exact repository gates appropriate to P2-06 passed.

## Next task

Audit the smallest real FFmpeg proxy-generation slice behind the verified immutable/durable proxy revision boundary. Keep execution shell-free/bounded and selectively triggered, source from managed immutable media, preserve exact scene/source lineage, and treat generated proxy bytes/location/timestamps as rebuildable derivative state rather than canonical timing authority.
