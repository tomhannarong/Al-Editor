# Checkpoint 0052 — Phase 2 immutable scene-set revision persistence verified

Date: 2026-08-25 (Asia/Bangkok)

Starting HEAD: `ea4bb6c169e217ec946d30e0d0a4d4356fcfe9a5`.

## Required startup audit

This run re-read `PROJECT_BIBLE.md`, `docs/ai-editor/progress.json`, `docs/ai-editor/PROGRESS.md`, `docs/ai-editor/IMPLEMENTATION_MAPPING.md`, checkpoint 0051, exact `main` HEAD and available CI evidence before modifying code.

The exact starting HEAD was documentation-only and had no Actions run, matching workflow path filters. P2-01 was verified and established versioned scene-set identity plus exact immutable asset/stream/native-PTS source mapping. Proxy/keyframe generation remained downstream and was not started.

The execution container still could not resolve `github.com`, so no local clone/test pass is claimed.

## Selected slice

The smallest dependency-correct unfinished Phase-2 item was **immutable scene-set revision persistence/idempotency**. This closes the mutation gap between the P2-01 contract and future durable/derivative work.

Implementation commit:

`c877b5e91f190ba490a1b6767759b4ff69268e02` — `feat: add immutable scene-set revision persistence`

Added:

- `packages/scene-library/src/index.ts`
- `packages/scene-library/src/index.test.ts`

## Persistence semantics

`InMemorySceneSetRevisionStore`:

- validates every candidate before persistence side effects;
- normalizes the rational source time base without converting to decimal time;
- treats `revisionId` as immutable persistence identity;
- accepts exact semantic re-registration as idempotent, including equivalent rationals such as `1/90000` and `2/180000`;
- rejects reuse of an existing `revisionId` when scene-set identity, source mapping, detector version, creation evidence or scene intervals differ;
- allows a new `revisionId` for the same `sceneSetId`, preserving prior revisions as immutable evidence;
- stores and returns defensive copies so caller mutation cannot alter persisted evidence.

No proxy/keyframe fields, seconds or milliseconds were introduced as authority.

## Validation and repair

The implementation and tests were batched into one substantive commit before moving `main`.

First final-gate evidence:

- AI Editor CI run `32845448729`
- job `97793963767`
- exact implementation SHA `c877b5e91f190ba490a1b6767759b4ff69268e02`
- install: success
- strict TypeScript: success
- Vitest: **failure** in one newly added assertion
- migration/contract gates: skipped after unit-test failure
- observable status correctly published `ai-editor-ci/unit-tests = failure`

The failing test used `toBeInstanceOf(SceneSetPersistenceInvariantError)` on the callback function instead of asserting the error thrown by the callback. This was a test assertion defect; the persistence behavior itself had already thrown as intended.

The failed run was **not rerun unchanged**. Repair commit:

`e221be705e2dbd69e14df5dbbca7b5b949f17c29` — `test: assert scene-set persistence validation error`

The repair changes only that assertion to `toThrow(SceneSetPersistenceInvariantError)`.

Exact repaired evidence:

- AI Editor CI run `32845521695`
- job `97794189378`
- exact repaired SHA `e221be705e2dbd69e14df5dbbca7b5b949f17c29`
- install dependencies: success
- strict TypeScript: success
- Vitest behavioral gate: success
- deterministic migration gate: success
- contract and policy gates: success
- observable status publication: success
- exact commit status: **`ai-editor-ci/all = success`**

No PostgreSQL/Qdrant local-stack, FFmpeg real-media integration, matrix or heavyweight derivative workflow was triggered because this slice is deterministic in-memory revision persistence.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time authority, renderer-neutral v2 adapter boundary, style profile, delivery profile, structured logging, provenance/rights evidence, immutable timeline revision/render evidence, Phase-1 media durability and FFmpeg `-copyts` behavior remain unchanged.

P2 scene timing remains native safe-integer PTS plus rational source time base. Equivalent rational normalization is exact and does not create decimal-time authority.

## Progress

```text
Standalone verified: 38 / 162 = 23.46%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:     14 / 14  = 100.00%
Phase 2 verified:      2 / 11  =  18.18%
```

## Next task

Audit the smallest durable PostgreSQL scene-set revision persistence/readback slice. Prefer an additive migration and adapter that reuse P2-02 immutable `revisionId` conflict/idempotency semantics and preserve exact asset/stream/native-PTS mapping. Keep proxy/keyframe generation blocked until durable scene-set evidence is explicit.
