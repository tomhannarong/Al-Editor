# Checkpoint 0055 — Phase 2 proxy derivative persistence/idempotency verified

Date: 2026-08-25 (Asia/Bangkok)

Starting HEAD: `fec36593251ec724b638b217a1d94f1f06d5f125`.

## Required startup audit

This run re-read `PROJECT_BIBLE.md`, `docs/ai-editor/progress.json`, `docs/ai-editor/PROGRESS.md`, `docs/ai-editor/IMPLEMENTATION_MAPPING.md`, checkpoint 0054, exact `main` HEAD and available CI evidence before modifying code.

Starting progress was 40/162 standalone verified and Phase 2 was 4/11. The latest substantive evidence was P2-04 implementation `236dba5785f33eb861094f08459840cbec223a93` with AI Editor CI run `32857635477` success. The docs-only starting HEAD had no newer substantive gate to satisfy.

The execution environment has no usable local repository clone, so no local test pass is claimed. The smallest dependency-correct unfinished item was the explicit proxy derivative revision persistence/idempotency boundary required before durable storage or FFmpeg generation.

## Selected slice

P2-05 — **immutable proxy derivative revision persistence/idempotency**.

Implementation commit:

`f950775fadea9b3681c4c7fdec93cb27b59f29f8` — `feat: persist immutable proxy derivative revisions`

Added:

- `packages/proxy-library/src/index.ts`
- `packages/proxy-library/src/index.test.ts`

## Semantics

`InMemoryProxyDerivativeRevisionStore` makes `revisionId` immutable evidence identity.

- valid first registration is stored with normalized rational source time base;
- semantic re-registration, including an equivalent rational such as `2/180000` for `1/90000`, is idempotent and returns `created: false`;
- reuse of the same `revisionId` with changed scene-set/source lineage, derivative profile, toolchain, artifact URI or creation evidence fails closed before mutation;
- stored evidence and readback are defensive copies;
- rebuilding to changed derivative state uses a new revision ID instead of mutating historical evidence.

The artifact URI remains rebuildable derivative state and does not redefine canonical source identity. Native PTS/rational source mapping rules from the existing contracts remain unchanged; this slice introduces no seconds/milliseconds authority.

## Validation

Exactly one normal final-gate run was used:

- AI Editor CI run `32863422284`
- job `97852730546`
- exact implementation SHA `f950775fadea9b3681c4c7fdec93cb27b59f29f8`
- install: success
- strict TypeScript: success
- Vitest behavioral gate: success
- deterministic migration gate: success
- contract/policy gates: success
- observable status publication: success
- exact commit status: **`ai-editor-ci/all = success`**

No PostgreSQL/Qdrant local-stack, FFmpeg proxy generation, matrix, rerun or heavyweight media workflow was triggered because P2-05 changes deterministic metadata persistence semantics only.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time rules, renderer-neutral v2 adapter boundary, style/delivery/provenance/model contracts, structured logging, immutable revision/render evidence, Phase-1 media durability, scene-set PostgreSQL evidence and FFmpeg `-copyts` behavior remain unchanged.

No canonical contract was silently changed. Proxy derivatives remain versioned/rebuildable and downstream of immutable scene-set/source authority.

## Progress

```text
Standalone verified: 41 / 162 = 25.31%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:     14 / 14  = 100.00%
Phase 2 verified:      5 / 11  =  45.45%
```

## Failures / blockers

None for P2-05. No unavailable runner or skipped gate is represented as a pass.

## Next task

Audit the smallest durable PostgreSQL proxy derivative revision persistence/readback boundary. Reuse P2-05 immutable conflict/idempotency semantics and preserve scene-set/source lineage. Keep artifact state rebuildable and do not start real FFmpeg proxy generation until durable derivative evidence is independently verified.
