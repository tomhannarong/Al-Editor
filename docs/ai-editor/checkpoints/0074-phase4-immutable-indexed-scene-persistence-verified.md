# Checkpoint 0074 — Phase 4 immutable indexed-scene persistence verified

## Scope

Implemented P4-03: immutable indexed-scene document persistence/idempotency. No Qdrant durability, hybrid retrieval, reranking, editorial scoring or Recall@10 benchmark was introduced in this slice.

## Starting state

- Starting `main` HEAD: `d9fe294267eb90cc597952582f68ba7a5f4087f7`
- Previous task: P4-02 versioned indexed-scene document contract, complete
- Starting HEAD was documentation-only and had no commit statuses; this was not treated as a failure
- P4-02 implementation SHA `94573491cdd7626967a0961a3dab2aa2090c4567` retained exact `ai-editor-ci/all = success`
- Bible Phase-4 gate requires query schema, indexed scenes and labeled Recall@10 baseline

## Implementation

Implementation commit: `f9ee0a20702fc683feee0891b07061d46d2e8857`

Files:

- `packages/indexed-scene-library/src/index.ts`
- `packages/indexed-scene-library/src/index.test.ts`

The store treats `revisionId` as immutable indexed-scene evidence identity. Exact semantic re-registration is idempotent, including rationally equivalent source time bases after normalization.

Reusing the same revision ID with changed document identity, scene-set/scene/source/native-PTS lineage, representation revision/text, embedding revision/model/version/dimensions/vector digest or creation evidence fails closed before mutation.

Changed representation/embedding evidence must therefore use a new additive revision. Read and registration results are deep defensive copies for source time-base and embedding evidence so callers cannot mutate historical state through returned objects.

Vector bytes and Qdrant locations remain explicitly outside this immutable metadata store as rebuildable index state. Native source PTS + rational stream time base remain timing authority.

## Validation / CI evidence

A local clone/test was attempted before relying on CI, but the execution environment could not resolve `github.com`. This was not counted as a pass or as a code failure.

AI Editor CI run `32955835977`, job `98137171731` completed successfully on exact implementation SHA `f9ee0a20702fc683feee0891b07061d46d2e8857`.

Passed stages:

- dependency install
- strict TypeScript
- Vitest behavioral gate
- deterministic migrations
- contract/policy gates
- observable commit status publication

Exact status: `ai-editor-ci/all = success`.

No PostgreSQL/Qdrant local-stack, FFmpeg/media integration run, matrix or rerun was used because P4-03 adds no runtime dependency.

## Preserved baseline

Canonical timeline v1/v2 compatibility, media-time authority, renderer-neutral adapter boundary, style/delivery/provenance/model contracts, structured logging, immutable revision/render evidence, Phase-1 media durability, Phase-2 scene/proxy/keyframe evidence and Phase-3 transcript/editorial-segment evidence are unchanged.

Retrieval relevance remains separate from editorial judgment. No Phase-5 hybrid/reranker behavior was introduced.

## Progress

```text
Standalone verified: 59 / 162 = 36.42%
Phase 0:             22 / 22  = 100.00%
Phase 1:             14 / 14  = 100.00%
Phase 2:             11 / 11  = 100.00%
Phase 3:              9 / 9   = 100.00%
Phase 4:              3 verified slices
```

The Phase-4 denominator remains intentionally unset until exact checklist authority establishes it.

## Failures / blockers

- No P4-03 gate failure remains.
- Local clone validation was unavailable because DNS resolution for `github.com` failed; it is not reported as a pass or code defect.
- P0-03/P0-04 retain prior real PostgreSQL/Qdrant runtime proof.
- No unavailable Actions runner was counted as a pass or code failure.
- No unchanged failed job was rerun.

## Next task

P4-04 — selective real-Qdrant indexed-scene durability/indexing. Reuse the P4-02/P4-03 immutable contract/store boundary, prove idempotent upsert and exact payload/readback against real Qdrant, keep vector bytes/storage rebuildable, and do not introduce hybrid/reranking behavior. After actual indexed scenes are proven, establish the labeled Recall@10 baseline required by the Phase-4 gate.
