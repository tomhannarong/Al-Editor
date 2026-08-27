# Phase 11 lightweight temporal baseline v1

This document freezes the lightweight control fixture used before any advanced temporal model is accepted.

## Identity

- benchmark: `temporal-benchmark:phase11`
- benchmark revision: `temporal-benchmark:phase11:r1`
- fixture revision: `temporal-fixture:lightweight-control:r1`
- control approach: `lightweight-scene-retrieval-control`
- control revision: `lightweight-scene-retrieval-control:r1`
- implementation: `packages/temporal-intelligence-library/src/lightweight-baseline.ts`
- fixture: `packages/temporal-intelligence-library/src/phase11-lightweight-baseline.fixture.ts`

## Fixture semantics

The control uses immutable scene revision IDs plus exact source asset/stream lineage and native integer PTS with rational time base. Each benchmark case labels an ordered, non-overlapping temporal continuation on one exact source stream and freezes the lightweight ranking that later candidates must beat on the same fixture.

Quality is measured without adding a second timing authority:

- `temporal-recall-at-10`: micro recall of labeled temporal continuation scenes in the top 10; higher is better.
- `ordered-sequence-completion-rate`: fraction of cases whose entire labeled continuation appears in the expected order in the top 10; higher is better.
- `duplicate-occupancy`: fraction of ranked scenes that overlap an earlier ranked scene from the same asset/stream at native-PTS IoU >= 0.5; lower is better.

## Frozen deterministic control quality

- temporal Recall@10: `5 / 6 = 0.8333333333333334`
- ordered sequence completion: `2 / 3 = 0.6666666666666666`
- duplicate occupancy: `1 / 10 = 0.1`
- benchmark cases: `3`
- labeled expected scenes: `6`
- ranked control scenes evaluated: `10`

These are deterministic fixture-quality values, not measured runtime cost.

## Cost evidence status

The Phase-11 Bible gate requires a benchmark win **and measured cost vs the lightweight baseline**. This P11-02 fixture intentionally does not fabricate wall-clock or compute-unit measurements inside unit tests. Runtime cost measurement remains a separate next slice and must bind to this exact benchmark revision, fixture revision and control approach revision before a candidate comparison can close the Phase-11 gate.
