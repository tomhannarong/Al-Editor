# Checkpoint 0073 — Phase 4 indexed-scene document contract verified

## Scope

Implemented P4-02: the smallest missing Phase-4 indexed-scene document contract. No Qdrant durability, hybrid retrieval, reranking or editorial-scoring capability was introduced.

## Starting state

- Starting `main` HEAD: `cfe89220ba849729cd7473999baa80866382bb7d`
- Previous task: P4-01 baseline scene-retrieval query schema, complete
- Starting HEAD was documentation-only and had no commit statuses; this was not treated as a failure
- P4-01 implementation SHA `22db5e278b96d8a064c0fd50ef96894d1f72c1a4` retained exact `ai-editor-ci/all = success`
- Bible Phase-4 gate requires query schema, indexed scenes and labeled Recall@10 baseline

## Implementation

Implementation commit: `94573491cdd7626967a0961a3dab2aa2090c4567`

Files:

- `packages/contracts/src/indexed-scene-document.contract.ts`
- `packages/contracts/src/indexed-scene-document.contract.test.ts`
- `packages/contracts/src/index.ts`

The contract binds each retrievable document to exact `sceneSetId`, `sceneSetRevisionId`, `sceneId`, immutable SHA-256 asset identity, stream identity/index, native integer source start/end PTS and rational source time base.

It also records explicit `representationRevisionId` and embedding evidence through `embeddingRevisionId`, pinned `modelId/modelVersion`, validated vector dimensions and a SHA-256 digest of the vector. The vector bytes/storage location remain rebuildable index state and do not become canonical source identity.

Rational time bases normalize for exact lineage comparison. Mutable asset paths, invalid stream indexes, invalid/inverted native-PTS intervals, invalid rationals, unpinned embedding model aliases, invalid dimensions/digests and missing revision evidence fail closed.

Hybrid features, reranker scores and editorial judgment are absent by design so Phase-5 behavior does not contaminate the Phase-4 baseline.

## Validation / CI evidence

A local clone/test was attempted before relying on CI, but the execution environment could not resolve `github.com`. This was not counted as a pass or as a code failure.

AI Editor CI run `32950451152`, job `98120424232` completed successfully on exact implementation SHA `94573491cdd7626967a0961a3dab2aa2090c4567`.

Passed stages:

- dependency install
- strict TypeScript
- Vitest behavioral gate
- deterministic migrations
- contract/policy gates
- observable commit status publication

Exact status: `ai-editor-ci/all = success`.

No PostgreSQL/Qdrant local-stack, FFmpeg/media integration run, matrix or rerun was used because P4-02 adds no runtime dependency.

## Preserved baseline

Canonical timeline v1/v2 compatibility, media-time authority, renderer-neutral adapter boundary, style/delivery/provenance/model contracts, structured logging, immutable revision/render evidence, Phase-1 media durability, Phase-2 scene/proxy/keyframe evidence and Phase-3 transcript/editorial-segment evidence are unchanged.

Native PTS + rational stream time base remain source-time authority. Retrieval relevance remains separate from editorial judgment.

## Progress

```text
Standalone verified: 58 / 162 = 35.80%
Phase 0:             22 / 22  = 100.00%
Phase 1:             14 / 14  = 100.00%
Phase 2:             11 / 11  = 100.00%
Phase 3:              9 / 9   = 100.00%
Phase 4:              2 verified slices
```

The Phase-4 denominator is not invented here because no exact current checklist denominator has yet been established in the standalone progress authority.

## Failures / blockers

- No P4-02 gate failure remains.
- Local clone validation was unavailable because DNS resolution for `github.com` failed; it is not reported as a pass or code defect.
- P0-03/P0-04 retain prior real PostgreSQL/Qdrant runtime proof.
- No unavailable Actions runner was counted as a pass or code failure.

## Next task

P4-03 — immutable indexed-scene document persistence/idempotency. Exact semantic re-registration of the same revision should be idempotent; reusing a revision ID with changed scene/source/representation/embedding evidence must fail closed before mutation. Keep Qdrant durability and Recall@10 benchmarking as later selective Phase-4 slices after this deterministic store boundary is established.
