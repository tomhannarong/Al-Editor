# AI Local Footage Editor — Progress

**Repository:** `tomhannarong/Al-Editor` / `main`  
**Phase:** 4 — Baseline Scene Retrieval  
**Current task:** P4-03 — immutable indexed-scene document persistence/idempotency

```text
Standalone verified: 58 / 162 = 35.80%
Phase 0:             22 / 22  = 100.00% COMPLETE
Phase 1:             14 / 14  = 100.00% COMPLETE
Phase 2:             11 / 11  = 100.00% COMPLETE + GATE VERIFIED
Phase 3:              9 / 9   = 100.00% COMPLETE + GATE VERIFIED
Phase 4:              2 verified slices; denominator not invented before checklist audit
```

## Phase 4 — P4-02 verified

P4-02 adds the versioned indexed-scene document contract required before any durable/Qdrant index can be trusted as exact scene evidence.

`packages/contracts/src/indexed-scene-document.contract.ts` binds each retrievable document to exact `sceneSetId`, `sceneSetRevisionId`, `sceneId`, immutable SHA-256 asset identity, stream identity/index, native integer source start/end PTS and rational source time base.

The same document records explicit `representationRevisionId` plus embedding evidence: `embeddingRevisionId`, pinned `modelId/modelVersion`, validated vector dimensions and a SHA-256 vector digest. The vector itself remains rebuildable index state; its provenance is reproducible evidence rather than canonical source identity.

Rational source time bases normalize for exact lineage comparison. Mutable asset paths, invalid source intervals/indexes/rationals, unpinned embedding model aliases, invalid dimensions/digests and missing revision evidence fail closed. Hybrid features, reranker scores and editorial judgment remain absent so Phase 5 does not leak into the baseline.

## Exact evidence

Implementation commit `94573491cdd7626967a0961a3dab2aa2090c4567` was committed directly to `main` as one batched contract/test/export change.

AI Editor CI run `32950451152`, job `98120424232` passed dependency install, strict TypeScript, Vitest, deterministic migrations, contract/policy gates and observable commit status `ai-editor-ci/all = success`.

A local clone/test was attempted first, but the execution environment could not resolve `github.com`. This was not counted as a pass or code failure. No PostgreSQL/Qdrant local-stack, FFmpeg/media workflow, matrix or rerun was used because P4-02 introduces no runtime dependency.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time authority, renderer-neutral v2 adapter boundary, style/delivery/provenance/model contracts, structured logging, immutable revision/render evidence, Phase-1 media durability, Phase-2 scene/proxy/keyframe evidence and Phase-3 transcript/editorial-segment evidence remain unchanged.

Native PTS + rational stream time base remain source-time authority. Retrieval relevance remains separate from editorial judgment.

## Next task

P4-03 — implement immutable indexed-scene document persistence/idempotency. Exact semantic re-registration of a revision should be idempotent, while reusing a revision ID with changed scene/source/representation/embedding evidence must fail closed before mutation. Durable Qdrant indexing remains a later selective runtime slice after this local contract/store boundary is established.
