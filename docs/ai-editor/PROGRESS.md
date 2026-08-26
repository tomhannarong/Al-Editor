# AI Local Footage Editor — Progress

**Repository:** `tomhannarong/Al-Editor` / `main`  
**Phase:** 4 — Baseline Scene Retrieval  
**Current task:** P4-06 — Phase-4 gate reconciliation

```text
Standalone verified: 61 / 162 = 37.65%
Phase 0:             22 / 22  = 100.00% COMPLETE
Phase 1:             14 / 14  = 100.00% COMPLETE
Phase 2:             11 / 11  = 100.00% COMPLETE + GATE VERIFIED
Phase 3:              9 / 9   = 100.00% COMPLETE + GATE VERIFIED
Phase 4:              5 verified slices; denominator not invented before checklist audit
```

## Phase 4 — P4-05 verified

P4-05 establishes the versioned labeled Recall@10 baseline required by the Bible before Phase 4 can close. `packages/indexed-scene-library/src/recall-baseline.ts` evaluates only single-vector cosine retrieval over validated `IndexedSceneDocument` evidence and exact `BaselineSceneRetrievalQuery` scopes. It validates immutable source-vector digest evidence before scoring, requires relevance labels to resolve to actual indexed-scene revisions inside exact query scope, fixes the cutoff at 10, and uses deterministic revision-ID tie breaking.

The versioned fixture at `docs/ai-editor/benchmarks/phase4-labeled-recall-at-10-baseline-v1.md` contains 12 indexed-scene documents and three labeled queries. Measured v1 results are Macro Recall@10 = `0.8333333333333334` and Micro Recall@10 = `0.75` (3 of 4 labeled relevant scenes retrieved). These are baseline measurements, not acceptance thresholds.

## Exact evidence

Implementation commit `3e3571abb4627d3d1ac68f65c184ecb1a7be5242` was committed directly to `main` as one batched code/test/benchmark change.

AI Editor CI run `32965904224`, job `98168207773`, passed dependency install, strict TypeScript, Vitest, deterministic migrations, contract/policy gates and observable status publication. Exact commit status is `ai-editor-ci/all = success`.

Local validation was attempted first, but the execution environment could not resolve `github.com`; this was not counted as a pass or code failure. No PostgreSQL/Qdrant local-stack, FFmpeg/media workflow, matrix or rerun was used because the new slice is a deterministic evaluation boundary and P4-04 already holds exact real-Qdrant indexing evidence.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time authority, renderer-neutral v2 adapter boundary, style/delivery/provenance/model contracts, structured logging, immutable revision/render evidence, Phase-1 media durability, Phase-2 scene/proxy/keyframe evidence and Phase-3 transcript/editorial-segment evidence remain unchanged.

Retrieval relevance remains separate from editorial judgment. P4-05 contains no hybrid weighting, reranking, duplicate-control policy or editorial scoring; those remain Phase 5 concerns.

## Phase-4 gate state

All explicit Bible gate requirements now have exact standalone evidence:

- query schema: P4-01;
- indexed scenes: P4-02/P4-03 plus P4-04 real-Qdrant durability;
- labeled Recall@10 baseline: P4-05.

The phase is not marked closed in this run solely by implication; P4-06 will reconcile these exact proofs against the Bible gate and advance to Phase 5 without spending a redundant Actions run if no gap is found.

## Next task

P4-06 — Phase-4 gate reconciliation. If the existing P4-01 through P4-05 evidence maps cleanly to `query schema, indexed scenes, labeled Recall@10 baseline`, close Phase 4 by documentation/evidence only and advance to Phase 5. Do not introduce hybrid retrieval or reranking before that reconciliation.
