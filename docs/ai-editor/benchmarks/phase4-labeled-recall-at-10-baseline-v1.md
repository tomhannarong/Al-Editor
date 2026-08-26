# Phase 4 — Labeled Recall@10 Baseline v1

**Benchmark revision:** `phase4-labeled-recall-at-10:v1`  
**Evaluator:** `packages/indexed-scene-library/src/recall-baseline.ts`  
**Purpose:** establish the Phase-4 single-vector retrieval baseline before any Phase-5 hybrid weighting, reranking or editorial scoring.

## Fixture

The deterministic fixture uses 12 validated `IndexedSceneDocument` records under one exact immutable scene-set/source scope. Each record carries pinned representation/embedding evidence and a source vector whose SHA-256 must match the immutable indexed-scene contract before evaluation.

The benchmark contains three labeled queries, each using the versioned `BaselineSceneRetrievalQuery` contract with `topK = 10`:

| Query | Relevant indexed-scene revisions | Recall@10 |
|---|---:|---:|
| `query-green-leading` | 2 | 0.50 |
| `query-blue-closing` | 1 | 1.00 |
| `query-balanced-mid` | 1 | 1.00 |

Measured v1 result:

- Macro Recall@10: `0.8333333333333334`
- Micro Recall@10: `0.75`
- Relevant labels: `4`
- Relevant labels retrieved in top 10: `3`

This is a **baseline measurement, not an acceptance threshold**. Later retrieval/model/scoring changes must compare against the same versioned benchmark or explicitly introduce a new benchmark revision with documented lineage.

## Determinism and contract rules

- Retrieval is cosine similarity over one pinned embedding family only.
- Candidate filtering uses exact scene-set revision, immutable asset/stream identity and normalized rational source time base from the query contract.
- Labels must resolve to actual indexed-scene revisions inside the exact query scope.
- Vector dimensions, finite values and immutable `vectorSha256` evidence are validated before scoring.
- Equal scores are resolved deterministically by indexed-scene revision ID.
- Recall cutoff is fixed at 10; the evaluator rejects another `topK` rather than silently measuring a different metric.
- Native source PTS/rational time-base authority is preserved; no milliseconds or decimal-time authority is introduced.
- Hybrid retrieval, reranking, duplicate-control policy and editorial judgment remain out of this Phase-4 baseline.
