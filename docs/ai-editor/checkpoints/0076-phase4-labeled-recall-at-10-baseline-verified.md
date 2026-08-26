# Checkpoint 0076 — Phase 4 labeled Recall@10 baseline verified

## Starting authority

- Starting `main` HEAD: `c713a184e4bca01804d7d655822ad8d28dcf6ae0`.
- `PROJECT_BIBLE.md` Phase-4 gate requires query schema, indexed scenes and a labeled Recall@10 baseline before advancing.
- P4-01 through P4-04 already provided the query schema, immutable indexed-scene evidence and real-Qdrant durability. P4-05 was the smallest missing dependent slice.

## Local/static validation attempt

A local clone/test was attempted before push, but the execution environment could not resolve `github.com`. This was not counted as a test pass and was not classified as a code failure.

## Implementation

Implementation commit `3e3571abb4627d3d1ac68f65c184ecb1a7be5242` added:

- `packages/indexed-scene-library/src/recall-baseline.ts`
- `packages/indexed-scene-library/src/recall-baseline.test.ts`
- `docs/ai-editor/benchmarks/phase4-labeled-recall-at-10-baseline-v1.md`

The evaluator is deliberately a Phase-4 baseline only: single-vector cosine similarity over validated `IndexedSceneDocument` candidates inside exact `BaselineSceneRetrievalQuery` scopes. It validates candidate document contracts, pinned embedding family/dimensions, source-vector SHA-256 evidence, non-zero finite vectors, exact scoped relevance labels and a fixed cutoff of 10. Ties are resolved deterministically by indexed-scene revision ID.

No hybrid weighting, reranking, duplicate-control policy or editorial judgment was added.

## Measured baseline

Versioned benchmark revision: `phase4-labeled-recall-at-10:v1`.

Fixture:

- 12 actual typed `IndexedSceneDocument` records under one exact immutable scene/source scope;
- 3 labeled `BaselineSceneRetrievalQuery` cases;
- 4 total relevant labels.

Measured result:

- Macro Recall@10 = `0.8333333333333334`;
- Micro Recall@10 = `0.75`;
- 3 of 4 relevant labels retrieved in top 10.

These numbers are baseline evidence, not acceptance thresholds.

## Exact final gate

AI Editor CI run `32965904224`, job `98168207773`, on exact implementation SHA `3e3571abb4627d3d1ac68f65c184ecb1a7be5242`:

- Install dependencies: success
- TypeScript strict gate: success
- Vitest behavioral gate: success
- Migration deterministic gate: success
- Contract and policy gates: success
- Publish observable commit status: success
- exact commit status: `ai-editor-ci/all = success`

No PostgreSQL/Qdrant local-stack or FFmpeg workflow was spent for this deterministic benchmark slice; P4-04 already holds exact real-Qdrant evidence. No rerun was required.

## Invariants preserved

- Canonical timeline v1/v2 and native PTS/rational source-time authority are unchanged.
- Every candidate retains exact immutable scene-set revision, scene, asset, stream and native-PTS lineage.
- Query filtering uses the existing versioned baseline query schema and normalized rational source time base.
- Source embedding vector digest is verified before scoring; index/vector storage remains rebuildable state.
- Retrieval relevance remains separate from editorial judgment.
- The benchmark is versioned so Phase-5 changes can be compared before/after on the same evidence.

## Progress

Standalone verified: `61 / 162 = 37.65%`.

Phase 0 remains 22/22 complete; Phase 1 remains 14/14 complete; Phase 2 remains 11/11 complete with gate evidence; Phase 3 remains 9/9 complete with gate evidence. Phase 4 now has five verified slices; its denominator remains un-invented pending explicit checklist authority.

## Next task

P4-06 — reconcile P4-01 through P4-05 against the exact Phase-4 Bible gate. Since query schema, indexed scenes and labeled Recall@10 baseline now all have exact evidence, this should be documentation/evidence closure only unless the audit exposes a real gap. Do not spend a redundant Actions run for gate reconciliation.
