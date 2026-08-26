# Checkpoint 0072 — Phase 4 baseline retrieval query contract verified

## Scope

Implemented P4-01: the smallest missing Phase-4 baseline scene-retrieval query-schema contract. No hybrid retrieval, reranking or editorial-scoring capability was introduced.

## Starting state

- Starting `main` HEAD: `3001345eeb4ed792f279cd7c170e2335b94a7623`
- Previous task: P3-09 Phase-3 gate reconciliation, complete
- Starting HEAD was documentation-only and had no commit statuses; this was not treated as a failure
- Bible Phase-4 gate requires query schema, indexed scenes and labeled Recall@10 baseline

## Implementation

Implementation commit: `22db5e278b96d8a064c0fd50ef96894d1f72c1a4`

Files:

- `packages/contracts/src/baseline-scene-retrieval-query.contract.ts`
- `packages/contracts/src/baseline-scene-retrieval-query.contract.test.ts`
- `packages/contracts/src/index.ts`

The contract provides a versioned textual query with immutable-friendly `queryId` / `revisionId`, bounded query text, bounded `topK`, and one or more exact retrieval scopes. Each scope binds `sceneSetId`, `sceneSetRevisionId`, canonical SHA-256 asset identity, stream identity/index and rational source time base.

Rational time bases are normalized before exact scope identity comparison. Duplicate exact scopes fail closed. Mutable paths, invalid source identities/indexes/rationals and malformed query bounds fail validation.

Hybrid weights, reranker policy and editorial scoring are absent by design so Phase-5 behavior does not contaminate the baseline.

## Validation / CI evidence

AI Editor CI run `32945732425`, job `98105919843` completed successfully on exact implementation SHA `22db5e278b96d8a064c0fd50ef96894d1f72c1a4`.

Passed stages:

- dependency install
- strict TypeScript
- Vitest behavioral gate
- deterministic migrations
- contract/policy gates
- observable commit status publication

Exact status: `ai-editor-ci/all = success`.

No PostgreSQL/Qdrant local-stack or FFmpeg/media integration run was used because P4-01 adds no runtime dependency. No matrix and no rerun were used.

## Preserved baseline

Canonical timeline v1/v2 compatibility, media-time authority, renderer-neutral adapter boundary, style/delivery/provenance/model contracts, structured logging, immutable revision/render evidence, Phase-1 media durability, Phase-2 scene/proxy/keyframe evidence and Phase-3 transcript/editorial-segment evidence are unchanged.

## Progress

```text
Standalone verified: 57 / 162 = 35.19%
Phase 0:             22 / 22  = 100.00%
Phase 1:             14 / 14  = 100.00%
Phase 2:             11 / 11  = 100.00%
Phase 3:              9 / 9   = 100.00%
Phase 4:              1 verified slice
```

The Phase-4 denominator is not invented here because no exact current checklist denominator has yet been established in the standalone progress authority.

## Failures / blockers

- No P4-01 gate failure remains.
- P0-03/P0-04 retain prior real PostgreSQL/Qdrant runtime proof.
- No unavailable runner was counted as a pass or code failure.

## Next task

P4-02 — versioned indexed-scene document contract. Bind each retrievable document to exact scene-set revision + scene ID + immutable source lineage and explicit embedding/model revision metadata. Keep hybrid retrieval and reranking out of this phase until the baseline query/index/Recall@10 gate is proven.
