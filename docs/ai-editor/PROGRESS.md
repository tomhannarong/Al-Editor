# AI Local Footage Editor — Progress

**Repository:** `tomhannarong/Al-Editor` / `main`  
**Phase:** 4 — Baseline Scene Retrieval  
**Current task:** P4-02 — versioned indexed-scene document contract

```text
Standalone verified: 57 / 162 = 35.19%
Phase 0:             22 / 22  = 100.00% COMPLETE
Phase 1:             14 / 14  = 100.00% COMPLETE
Phase 2:             11 / 11  = 100.00% COMPLETE + GATE VERIFIED
Phase 3:              9 / 9   = 100.00% COMPLETE + GATE VERIFIED
Phase 4:              1 verified slice; denominator not invented before checklist audit
```

## Phase 4 — P4-01 verified

P4-01 adds the smallest missing baseline-retrieval contract required by the Bible gate: a versioned textual query bound to exact indexed scene-set/source lineage.

`packages/contracts/src/baseline-scene-retrieval-query.contract.ts` defines `queryId`, immutable-friendly `revisionId`, bounded `queryText`, bounded `topK`, and one or more exact scopes carrying `sceneSetId`, `sceneSetRevisionId`, immutable SHA-256 asset identity, stream identity/index and rational source time base.

Scope equality normalizes rational time bases and compares exact immutable lineage. Duplicate exact scopes fail closed. Invalid mutable asset paths, invalid stream indexes, invalid rationals, empty/oversized query text and invalid `topK` fail validation.

Hybrid weights, reranker policy and editorial scoring are intentionally absent so Phase 5 behavior cannot leak into the Phase-4 baseline.

## Exact evidence

Implementation commit `22db5e278b96d8a064c0fd50ef96894d1f72c1a4` was committed directly to `main` as one batched contract/test/export change.

AI Editor CI run `32945732425`, job `98105919843` passed dependency install, strict TypeScript, Vitest, deterministic migrations, contract/policy gates and observable commit status `ai-editor-ci/all = success`.

No PostgreSQL/Qdrant local-stack, FFmpeg/media workflow, matrix or rerun was used because this slice is a deterministic contract boundary and no runtime dependency is introduced.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time authority, renderer-neutral v2 adapter boundary, style/delivery/provenance/model contracts, structured logging, immutable revision/render evidence, Phase-1 media durability, Phase-2 scene/proxy/keyframe evidence and Phase-3 transcript/editorial-segment evidence remain unchanged.

Native PTS + rational stream time base remain source-time authority. Retrieval relevance remains separate from editorial judgment.

## Next task

P4-02 — implement the smallest versioned indexed-scene document contract that binds one retrievable document to an exact scene-set revision + scene ID + immutable source lineage and explicit embedding/model revision metadata, without adding hybrid retrieval or reranking logic.
