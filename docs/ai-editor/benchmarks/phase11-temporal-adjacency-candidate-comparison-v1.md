# Phase 11 — Advanced Temporal Candidate Comparison v1

## Authority

- Benchmark: `temporal-benchmark:phase11`
- Benchmark revision: `temporal-benchmark:phase11:r1`
- Fixture revision: `temporal-fixture:lightweight-control:r1`
- Lightweight approach: `lightweight-scene-retrieval-control:r1`
- Candidate approach: `temporal-adjacency-overlap-candidate:r1`
- Comparison revision: `temporal-comparison:phase11:adjacency-r1`

## Candidate behavior

The candidate uses exact asset/stream lineage and native source PTS to insert the nearest valid temporal successor after ranked scenes. It suppresses high-overlap duplicates at IoU >= 0.5 and caps each candidate ranking at 10 items.

Expected benchmark labels are evaluation-only evidence. A dedicated test mutates the expected labels while confirming the produced candidate rankings remain unchanged, preventing benchmark-label leakage into the ranking policy.

## Same-fixture quality result

| Metric | Lightweight | Candidate | Direction | Result |
|---|---:|---:|---|---|
| temporal-recall-at-10 | 0.8333333333333334 | 1.0 | higher-is-better | improved |
| ordered-sequence-completion-rate | 0.6666666666666666 | 1.0 | higher-is-better | improved |
| duplicate-occupancy | 0.1 | 0.0 | lower-is-better | improved |

The candidate improves every frozen Phase-11 quality metric.

## Same-process cost result

Successful CI evidence was captured on Node `v22.23.2`, Linux x64, in a single test process with 50 warmups, 5 samples and 1000 measured evaluations per sample.

Lightweight baseline samples in ms/evaluation:

`[0.056503342000000005, 0.023003296, 0.014320703, 0.012327988, 0.012318975]`

Candidate samples in ms/evaluation:

`[0.083928219, 0.068965395, 0.048893583, 0.040907964, 0.040091123000000006]`

- baseline median wall-clock: `0.014320703 ms/evaluation`
- candidate median wall-clock: `0.048893583 ms/evaluation`
- observed candidate/baseline wall-clock ratio: approximately `3.414x`
- baseline normalized compute: `10 ranked-scene-evaluation:v1 units/evaluation`
- candidate normalized compute: `11 ranked-scene-evaluation:v1 units/evaluation`

The ratio is reported as evidence only. No arbitrary acceptable cost threshold is introduced.

## Validation evidence

Initial implementation `b70015ee6c2bf1ddefbd320c2328abff5fac0c2d` passed strict TypeScript but failed three test assertions because the expected candidate ranking/count in the test was wrong. It was not rerun unchanged.

Repair `096863f2930b3ab6e5a96e7c2ab8f4e6daa124c3` corrected only those assertions. AI Editor CI run `33106247598`, job `98636758233`, passed strict TypeScript, `68` Vitest files / `372` tests, deterministic migrations, contract/policy gates and exact `ai-editor-ci/all = success`.

## Gate conclusion

Phase 11 requires a benchmark win plus measured cost versus the lightweight baseline. Both conditions are now satisfied on the exact frozen benchmark revision, so the Phase-11 gate is verified complete.
