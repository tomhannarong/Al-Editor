# Checkpoint 0063 — Phase 3 immutable transcript revision contract verified

Date: 2026-08-26 (Asia/Bangkok)

Starting HEAD: `f67bdc5e4da430d519f9e15c1e57bb3108981283`.

## Required startup audit

This run re-read `PROJECT_BIBLE.md`, `docs/ai-editor/progress.json`, `docs/ai-editor/PROGRESS.md`, `docs/ai-editor/IMPLEMENTATION_MAPPING.md`, checkpoint 0062, exact `main` HEAD and available CI evidence before changing code.

Phase 2 was verified complete. Historical CIOS progress authority was also inspected only to recover the original Phase-3 checklist denominator; it records Phase 3 as 9 items. No historical Phase-3 item was treated as standalone verified evidence.

## Selected slice

P3-01 — versioned immutable transcript / ASR-correction lineage contract.

Implementation commit: `af1b62e8cd1aa154cadfad0d1afcbf20106a3049`.
Repair commit: `0921bcd24909620f989b61a7764f78358c0ea466`.

## Implementation

- Added `packages/contracts/src/transcript.contract.ts`.
- Added `packages/contracts/src/transcript.contract.test.ts`.
- Exported the contract from `packages/contracts/src/index.ts`.

The contract:

- binds transcript evidence to canonical SHA-256 asset identity plus exact audio `streamId` / `streamIndex`;
- carries rational source stream time base;
- makes safe-integer `sourceStartPts` / `sourceEndPts` the only word-time authority;
- deliberately excludes milliseconds and decimal-second canonical fields;
- requires unique stable `wordId` values and zero-based stable `ordinal` positions;
- requires ordered, non-overlapping positive-duration word intervals;
- validates optional ASR confidence as bounded untrusted model evidence;
- distinguishes immutable root `asr` revisions from additive `correction` revisions;
- forbids a root ASR revision from claiming a parent;
- requires a correction revision to identify a distinct immutable `parentRevisionId`;
- normalizes rational time bases for exact source-mapping comparison.

This preserves the Bible rule that model output is untrusted data and that correction work creates versioned evidence rather than destructively rewriting earlier model output.

## Validation and failure handling

### Initial CI failure

AI Editor CI run `32909341505`, job `98000143093`, on implementation SHA `af1b62e8cd1aa154cadfad0d1afcbf20106a3049`:

- install dependencies: success
- TypeScript strict gate: **failure**
- Vitest behavioral gate: skipped
- migration deterministic gate: skipped
- contract/policy gates: skipped
- observable status: `ai-editor-ci/typecheck = failure`

Exact failure: two test fixture spreads used indexed array elements under `noUncheckedIndexedAccess` / `exactOptionalPropertyTypes`, making required `TranscriptWord` fields appear optional to TypeScript.

The failed commit was not rerun unchanged and was not marked verified.

### Repair

Repair `0921bcd24909620f989b61a7764f78358c0ea466` changed only the two strict test-harness spreads to assert the known fixture indexes as present. Canonical contract semantics were not changed.

### Final exact evidence

AI Editor CI run `32909410505`, job `98000354561`, on exact repair SHA `0921bcd24909620f989b61a7764f78358c0ea466`:

- install dependencies: success
- TypeScript strict gate: success
- Vitest behavioral gate: success
- migration deterministic gate: success
- contract/policy gates: success
- observable commit status: `ai-editor-ci/all = success`

No PostgreSQL/Qdrant local-stack, FFmpeg media integration, matrix or heavyweight workflow was used because this slice is a pure contract/validation boundary and those gates would be redundant.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time rules, renderer-neutral v2 adapter boundary, style profile, delivery profile, structured logging, provenance/rights work, immutable revision/render evidence, Phase-1 media durability and Phase-2 scene/proxy/keyframe contracts remain unchanged.

Native source PTS + rational stream time base remain authoritative.

## Progress

```text
Standalone verified: 48 / 162 = 29.63%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:     14 / 14  = 100.00%
Phase 2 verified:     11 / 11  = 100.00% + gate evidence
Phase 3 verified:      1 / 9   =  11.11%
```

## Failures / blockers

The initial strict TypeScript gate failure was repaired with a code/test change and is closed. No unavailable runner was treated as a pass or code failure. No correctness blocker remains for P3-01.

## Next task

P3-02 — immutable transcript revision persistence/idempotency. Re-registering semantically identical immutable evidence should be idempotent. Reusing a `revisionId` with changed source mapping, revision lineage, ASR model/language/createdAt evidence, word IDs/text/timing/order or confidence evidence must fail closed before mutation. PostgreSQL durability and real ASR/Whisper execution remain separate later slices.
