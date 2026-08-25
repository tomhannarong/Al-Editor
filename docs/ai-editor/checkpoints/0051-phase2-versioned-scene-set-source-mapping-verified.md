# Checkpoint 0051 — Phase 2 versioned scene-set source mapping verified

Date: 2026-08-25 (Asia/Bangkok)

Starting HEAD: `54223a0ded24d7f33cad9ec947936717f24c4db0`.

## Required startup audit

This run re-read `PROJECT_BIBLE.md`, `docs/ai-editor/progress.json`, `docs/ai-editor/PROGRESS.md`, `docs/ai-editor/IMPLEMENTATION_MAPPING.md`, checkpoint 0050, exact `main` HEAD and available CI evidence before modifying code.

Phase 1 was confirmed verified-complete. The exact starting HEAD was a documentation-only phase-closure commit with no Actions status, as expected from workflow path filters. Repository search found no existing scene-set implementation in Al-Editor. The migrated Creator Intelligence OS progress authority records Phase 2 as 11 checklist items; that count is retained as checklist provenance only, while new verification remains bound to exact Al-Editor evidence.

The execution container still cannot resolve `github.com`, so no local clone/test pass is claimed.

## Selected slice

The smallest dependency-correct unfinished Phase-2 capability was the **versioned scene-set identity and exact source-mapping contract**. The Bible requires Phase 2 to prove versioned scene sets and exact source mapping before proxies/keyframes can become useful derivatives.

Implementation commit:

`8759bc0437d672f4e63329fcc19b84172b9e433d` — `feat: add versioned scene-set source mapping contract`

Added:

- `packages/contracts/src/scene-set.contract.ts`
- `packages/contracts/src/scene-set.contract.test.ts`

## Contract semantics

`SceneSetRevision` now carries explicit:

- schema version;
- scene-set identity;
- revision identity;
- detector version;
- creation timestamp;
- immutable SHA-256 source asset identity;
- source stream identity and stream index;
- rational native stream time base;
- scene IDs with native integer `sourceStartPts` / `sourceEndPts`.

Validation fails closed for malformed content-addressed asset identity, missing stream identity, invalid stream index/time base, unsafe or fractional PTS, inverted intervals, duplicate scene IDs, and overlapping/out-of-order intervals.

`sameSceneSourceMapping(...)` compares immutable asset/stream identity and normalized rational time base exactly. Equivalent rationals such as `1/90000` and `2/180000` compare equal without introducing decimal-time authority.

Proxy/keyframe fields are deliberately absent from this source-mapping contract. They remain downstream rebuildable derivatives and cannot become scene timing authority.

## Validation

The substantive change was batched into one code commit before moving `main`; no intermediate broken pushes were created.

Exactly one normal CI run was used as final confidence evidence:

- AI Editor CI run `32840639465`
- job `97779125483`
- exact implementation SHA `8759bc0437d672f4e63329fcc19b84172b9e433d`
- install dependencies: success
- strict TypeScript: success
- Vitest behavioral gate: success
- deterministic migration gate: success
- contract/policy gates: success
- observable status publication: success
- exact commit status: **`ai-editor-ci/all = success`**

No PostgreSQL/Qdrant local-stack workflow, FFmpeg real-media integration, matrix or rerun was triggered because this slice is a deterministic contract/type/validation boundary.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time authority, renderer-neutral v2 adapter boundary, style profile, delivery profile, structured logging, provenance/rights evidence, immutable revision/render evidence, Phase-1 media identity/durability contracts and FFmpeg `-copyts` behavior remain unchanged.

Scene timing reuses native integer PTS plus rational stream time base. No seconds/milliseconds field was introduced as authority.

## Progress

```text
Standalone verified: 37 / 162 = 22.84%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:     14 / 14  = 100.00%
Phase 2 verified:      1 / 11  =   9.09%
```

## Next task

Audit and implement the smallest immutable scene-set revision persistence/idempotency slice. Prefer deterministic additive persistence semantics where exact re-registration of the same revision is idempotent but reuse of a `revisionId` with different source mapping or scene intervals fails closed. Keep proxies/keyframes blocked on this immutability boundary.
