# Checkpoint 0024 — P0-09 Canonical timeline v2 verified

Date: 2026-08-25 (Asia/Bangkok)

## Starting state

Current `main` before this slice was `ce5bb77065b7b77fb6e94f723ce57777f83e8b11`, with P0-08 already verified by checkpoint 0023. An attempted stale fast-forward from an overlapping P0-08 implementation was rejected by GitHub; no force push was used and the newer `main` state was preserved.

P0-03/P0-04 remain runtime-pending and P0-05 remains their direct dependent, so P0-09 was selected as the next safe independent item.

## Migration source and compatibility

Historical CIOS contracts were inspected directly. The historical v1 contract stores decimal-second compatibility fields, while v2 moves canonical project timing to integer frames + rational frame rate and source selection to native PTS + rational stream time base.

The standalone migration preserves this additively:

- `CanonicalTimelineV1` remains a readable compatibility type;
- `CanonicalTimelineV2` is schema version `2.0`;
- `ReadableCanonicalTimeline` accepts either schema;
- no v1 data is rewritten/destructively upgraded;
- v2 asset/source-audio items require integer native PTS and rational time base;
- v2 project placement requires integer frame ranges and rational FPS;
- decimal seconds are absent from v2 canonical source authority.

## Local evidence

```text
tsc --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --noEmit packages/contracts/src/canonical-timeline.contract.ts
PASS

runtime validation after compiling contract
PASS: canonical timeline v2 runtime validator + v1 readability (4 assertions)
```

Committed Vitest coverage verifies 30000/1001 project FPS with 1/90000 source time base, deterministic rational normalization, non-integer native PTS rejection and v1 readability.

## Gate decision

P0-09 is VERIFIED from migrated typed contract + validator + direct local compile/runtime evidence. This does not claim P0-10 conversion/rounding correctness yet.

Standalone progress:

```text
Overall: 8 / 162 = 4.94%
Phase 0: 8 / 22 = 36.36%
```

## GitHub Actions usage

No manual rerun/dispatch. This substantive code/test/progress change is one batched commit and may use the existing single validation job. P0-20 remains the repository CI authority.

## Next task

P0-10 centralized media-time conversion and rounding package with Bible-required golden rates/PTS behavior.
