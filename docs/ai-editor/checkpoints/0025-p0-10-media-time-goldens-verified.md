# Checkpoint 0025 — P0-10 Media-time goldens verified

Date: 2026-08-25 (Asia/Bangkok)

## Starting state

Exact starting `main` HEAD: `78197baf8f1f8575e9084a267f36d4f916b2b07f`. P0-09 canonical timeline v2 was verified immediately before this slice. P0-03/P0-04 remain runtime-pending and P0-05 remains their direct dependent.

## Migration source

The historical CIOS `packages/contracts/src/media-time.ts` authority was inspected directly. Its key correctness properties were preserved: BigInt arithmetic, normalized rationals, explicit rounding, safe-integer bounds and direct absolute frame↔PTS mapping rather than cumulative rounded frame durations.

## Implementation

Added `packages/media-time/src/index.ts` with:

- frame ↔ integer microseconds;
- native source PTS ↔ integer microseconds;
- direct absolute frame ↔ native source PTS;
- explicit `floor`, `ceil`, `nearest-half-away-from-zero` rounding;
- canonical rational normalization from P0-09;
- fail-closed unsafe-integer protection.

Added committed Vitest golden fixtures for all Bible-required CFR/fractional rates: 24/25/30/50/60, 24000/1001, 30000/1001 and 60000/1001. Tests map an absolute frame near ten minutes through native 1/90000 PTS and require exact frame round-trip, plus non-zero PTS and explicit boundary rounding.

## Local evidence

```text
tsc --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --noEmit packages/contracts/src/canonical-timeline.contract.ts packages/media-time/src/index.ts
PASS

runtime BigInt golden harness
PASS: 8 Bible frame-rate goldens + non-zero PTS + explicit rounding
```

## Gate decision

P0-10 is VERIFIED. This proves centralized conversion/rounding semantics and required rate/PTS golden behavior; it does not claim VFR media-file integration, which remains a later media correctness/integration gate.

Standalone progress:

```text
Overall: 9 / 162 = 5.56%
Phase 0: 9 / 22 = 40.91%
```

## GitHub Actions usage

No manual rerun or dispatch. This is one batched substantive commit; concurrency cancellation may supersede the prior P0-09 validation run. P0-20 remains repository CI authority.

## Next task

P0-11 Style profile schema v1.
