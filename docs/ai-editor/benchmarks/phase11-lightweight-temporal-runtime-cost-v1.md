# Phase 11 lightweight temporal runtime cost v1

This evidence records measured runtime cost for the exact frozen Phase-11 lightweight temporal control. It is evaluation/telemetry evidence only and does not introduce a timing authority for media or editorial decisions.

## Frozen identity

- benchmark: `temporal-benchmark:phase11`
- benchmark revision: `temporal-benchmark:phase11:r1`
- fixture revision: `temporal-fixture:lightweight-control:r1`
- approach: `lightweight-scene-retrieval-control`
- approach revision: `lightweight-scene-retrieval-control:r1`
- runtime protocol: `temporal-lightweight-runtime-cost:v1`
- normalized compute unit: `ranked-scene-evaluation:v1`
- implementation repair SHA: `c34ba453f8778d888eb132a712026f8f2df97092`

## Frozen quality carried into the measurement

- temporal Recall@10: `0.8333333333333334`
- ordered sequence completion rate: `0.6666666666666666`
- duplicate occupancy: `0.1`

The runtime harness validates these values against the frozen fixture before accepting the measurement and verifies that quality remains unchanged during measured iterations.

## Exact runtime evidence

AI Editor CI run `33104422868`, job `98630326740`, Node `v22.23.2`, Linux x64:

- warmup iterations: `50`
- measured iterations per sample: `1000`
- sample count: `5`
- sample ms/evaluation:
  - `0.023819472999999997`
  - `0.017779889`
  - `0.017220343`
  - `0.007584495`
  - `0.01181334`
- median wall clock ms/evaluation: `0.017220343`
- total measured wall clock: `78.21754 ms`
- normalized compute units/evaluation: `10`
- total measured compute units: `50000`

## Interpretation

`ranked-scene-evaluation:v1` is a deterministic normalized-workload unit: one unit means one ranked scene evaluated by the frozen lightweight benchmark logic. It is not a FLOP count, GPU-second, provider billing unit, or cost threshold.

Wall-clock measurements vary with machine load and runner hardware. Therefore later candidate acceptance must not compare a candidate measured on unrelated hardware against this number as if it were bit-stable performance. The preferred comparison protocol is to measure the frozen baseline and candidate in the same process/runtime on the same fixture and report both costs together.

No arbitrary acceptable cost ratio is established here. The Bible Phase-11 gate requires a benchmark win plus measured cost; the measured cost is evidence to evaluate the tradeoff, not a hidden pass/fail threshold.
