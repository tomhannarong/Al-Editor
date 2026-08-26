# Phase 5 — Hybrid + Duplicate-Control Same-Benchmark Evaluation v1

**Evaluation revision:** `phase5-hybrid-duplicate-control-evaluation:v1`  
**Control benchmark revision:** `phase4-labeled-recall-at-10:v1`  
**Evaluator:** `packages/hybrid-retrieval-library/src/benchmark-evaluation.ts`

## Purpose

Measure the verified Phase-5 weighted-cosine hybrid retrieval and duplicate-control path against the exact Phase-4 labeled Recall@10 control. This is retrieval evaluation only: no reranker, editorial scoring, or Editorial Brain signal participates.

## Versioned fixture

The evaluation reuses the exact 12 scene identities, three query IDs, and four relevance labels from the Phase-4 benchmark. The baseline representation remains unchanged. A second pinned `complementary-intent` representation adds deterministic, versioned evidence for the same immutable scenes; its vectors are independent rebuildable embedding state whose SHA-256 is validated before scoring.

Hybrid policy v1 uses two representations at 5,000 basis points each and a candidate pool of 12. Duplicate-control v1 uses `same-source-interval-iou-v1`, `maxResults = 10`, and an 8,000-basis-point overlap threshold.

The Phase-4 fixture's source intervals are non-overlapping, so duplicate occupancy is expected to measure zero on this benchmark. That does not replace P5-05's deterministic overlap/suppression tests; it records the actual occupancy of the same benchmark rather than manufacturing duplicate labels.

## Measured deterministic result

| Metric | Phase-4 control | Phase-5 hybrid + duplicate control | Gain |
|---|---:|---:|---:|
| Macro Recall@10 | `0.8333333333333334` | `1.0` | `0.16666666666666663` |
| Micro Recall@10 | `0.75` | `1.0` | `0.25` |
| Relevant labels retrieved | `3 / 4` | `4 / 4` | `+1` |
| Mean duplicate occupancy before control | n/a | `0.0` | measured |
| Mean duplicate occupancy after control | n/a | `0.0` | measured |

Per-query hybrid Recall@10 is `1.0 / 1.0 / 1.0` for `query-green-leading`, `query-blue-closing`, and `query-balanced-mid` respectively.

These values are benchmark measurements, not a globally invented acceptance threshold. The quality-gain claim is limited to this exact benchmark/control and these exact pinned Phase-5 policy/representation revisions.

## Determinism and invariants

- The evaluator first recomputes the Phase-4 control with the existing baseline evaluator.
- Hybrid policy benchmark lineage must match the exact benchmark ID and revision.
- Relevance labels are translated to immutable scene identity, so representation-specific indexed-document revision IDs do not redefine relevance.
- Every hybrid candidate still passes indexed-scene contract and vector SHA-256 validation before weighted-cosine scoring.
- Duplicate control must bind to the exact hybrid policy revision and return exactly the Recall@10 result cap.
- Native source PTS plus rational source time base remain source authority; no decimal-time authority is introduced.
- Duplicate occupancy is reported from actual suppression evidence; the control fixture contains no overlapping intervals, so the measured value is zero.
- No reranker or editorial judgment is present in this evaluation.
