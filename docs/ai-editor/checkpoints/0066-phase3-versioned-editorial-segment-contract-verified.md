# Checkpoint 0066 — Phase 3 versioned editorial segment contract verified

Date: 2026-08-26 (Asia/Bangkok)

Starting HEAD: `8882cf22c2d946fee7d593100f75046dbc4c395d`.
Implementation commit: `747e9151f685a517c50da77629ec0a93ff634b8f`.

## Required startup audit

This run re-read `PROJECT_BIBLE.md`, `docs/ai-editor/progress.json`, `docs/ai-editor/PROGRESS.md`, `docs/ai-editor/IMPLEMENTATION_MAPPING.md`, checkpoint 0065, exact `main` HEAD and available CI evidence before changing code.

P3-03 was verified complete on `e01b981876af149332304fe4cfd59b4f78b9a5f5`, with AI Editor CI `32917035651` and AI Editor Local Stack Gate `32917035721` successful. The docs-only starting HEAD had no CI statuses by design, so no failed dependency blocked P3-04.

## Selected slice

P3-04 — versioned editorial segment contract over immutable transcript revision/word identities.

## Implementation

Added in one batched implementation commit:

- `packages/contracts/src/editorial-segment.contract.ts`
- `packages/contracts/src/editorial-segment.contract.test.ts`
- package export through `packages/contracts/src/index.ts`

The persisted editorial segment revision binds to exact `transcriptId` + `transcriptRevisionId` and stores stable `startWordId` / `endWordId` boundaries only. It deliberately does not copy source PTS, seconds or milliseconds into segment evidence.

`resolveEditorialSegmentsAgainstTranscript(...)` validates the exact immutable transcript revision and derives native `sourceStartPts` / `sourceEndPts` plus the transcript source rational time base as read state. Resolution fails closed on transcript/revision lineage mismatch, missing word references, reversed word intervals, or overlapping/out-of-order segments.

This keeps stable word timing authoritative in the immutable transcript while giving later editorial planning a deterministic segment-level view without a parallel timing system.

## Validation evidence

AI Editor CI run `32920801878`, job `98033851515`, on exact SHA `747e9151f685a517c50da77629ec0a93ff634b8f`:

- install dependencies: success
- TypeScript strict gate: success
- Vitest behavioral gate: success
- migration deterministic gate: success
- contract/policy gates: success
- observable commit status: `ai-editor-ci/all = success`

No PostgreSQL/Qdrant local-stack run, FFmpeg/media integration run or matrix was used because this is a pure deterministic contract slice. No unchanged failed job was rerun.

Local/network validation was not claimed as passed; exact repository CI is the evidence for this slice.

## Preserved contracts

Canonical timeline v1/v2 compatibility, media-time rules, renderer-neutral v2 adapter boundary, style profile, delivery profile, structured logging, provenance/rights work, immutable revision/render evidence, Phase-1 media durability, Phase-2 scene/proxy/keyframe evidence and Phase-3 transcript durability remain unchanged.

Transcript/model evidence remains untrusted data. Corrections and segment revisions are additive immutable evidence. Native source PTS + rational stream time base remain the only source-time authority.

## Progress

```text
Standalone verified: 51 / 162 = 31.48%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:     14 / 14  = 100.00%
Phase 2 verified:     11 / 11  = 100.00% + gate evidence
Phase 3 verified:      4 / 9   =  44.44%
```

## Failures / blockers

No correctness gate failed in this slice. No unavailable runner was counted as success or code failure. No unchanged failed job was rerun.

## Next task

P3-05 — immutable editorial segment revision persistence/idempotency. Semantic re-registration of the same immutable revision must be idempotent; conflicting reuse of a revision ID with changed transcript lineage, segment word boundaries/order or creation evidence must fail closed before mutation. PostgreSQL durability remains a later selective slice.
