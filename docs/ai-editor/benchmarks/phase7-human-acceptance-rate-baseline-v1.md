# Phase 7 Human Acceptance Rate baseline v1

This deterministic fixture is the first valid Phase-7 HAR measurement. It measures durable human-review decisions only and keeps HAR, review coverage, and publish-without-edit rate separate.

## Versioned fixture

- measurement ID: `human-acceptance-rate:phase7-baseline`
- revision ID: `human-acceptance-rate:phase7-baseline:v1`
- eligible AI decisions: 6
- reviewed AI decisions: 4
- reviewed actions: 1 accept, 1 lock, 1 trim, 1 replace
- published AI decisions: 5

`har-v1` treats `accept` and `lock` as retaining the AI media decision without a replace/trim media edit. Replace and trim are reviewed edits. Unreviewed eligible decisions are excluded from the HAR denominator rather than counted as rejects.

## Measurement

| Metric | Result |
|---|---:|
| Human Acceptance Rate | 0.50 (2 / 4 reviewed decisions) |
| Review coverage | 0.6666666666666666 (4 / 6 eligible decisions) |
| Publish-without-edit rate | 0.80 (4 / 5 published decisions) |
| Accepted/retained reviewed decisions | 2 |
| Reviewed edits | 2 |

Publish-without-edit is independent of HAR. In this fixture, a published AI decision is without a human media edit when it is unreviewed, accepted, or locked; replace/trim decisions are edited.

## Invariants

- HAR denominator is reviewed AI decisions only.
- One AI decision may contribute at most once to a measurement revision.
- Reviewed and published decision IDs must belong to the explicit eligible population.
- Human-review decisions must pass the durable review contract validator before measurement.
- The evaluator stores/returns decision and revision lineage only; canonical project-frame/native-PTS timing remains in immutable timeline revisions.
- This baseline is a measurement, not an acceptance threshold and not a claim about production user behavior.
