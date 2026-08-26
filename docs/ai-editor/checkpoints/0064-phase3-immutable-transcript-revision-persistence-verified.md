# Checkpoint 0064 — Phase 3 immutable transcript revision persistence verified

Date: 2026-08-26 (Asia/Bangkok)

Starting HEAD: `14ee7659c502ec7334ddb240d7b8e82d99d9bc63`.
Implementation commit: `92037f27e0a5180e1706fc405d3ff7ecc5e8a148`.

## Required startup audit

This run re-read `PROJECT_BIBLE.md`, `docs/ai-editor/progress.json`, `docs/ai-editor/PROGRESS.md`, `docs/ai-editor/IMPLEMENTATION_MAPPING.md`, checkpoint 0063, exact `main` HEAD and available CI evidence before changing code.

P3-01 was verified complete on repaired implementation `0921bcd24909620f989b61a7764f78358c0ea466`, with AI Editor CI `32909410505` successful. No dependent gate was left failed, so P3-02 was eligible as the smallest unfinished Phase-3 slice.

## Selected slice

P3-02 — immutable transcript revision persistence/idempotency.

## Implementation

Added:

- `packages/transcript-library/src/index.ts`
- `packages/transcript-library/src/index.test.ts`

The store follows the existing immutable scene/proxy/keyframe persistence pattern rather than creating a parallel persistence model.

A `revisionId` is immutable evidence identity. The persistence boundary validates candidates before mutation, normalizes rational source time bases, treats semantically identical re-registration as idempotent, and fails closed if a caller reuses a revision ID with changed source mapping, revision kind/parent lineage, ASR model, language, creation evidence, word IDs/text/order/native timing or confidence.

Correction revisions remain additive. Tests prove that a correction using a new revision ID and explicit parent can coexist with the original ASR revision without mutating it. Read/write results deep-copy source time-base and word evidence so external mutation cannot alter stored historical evidence.

Native source PTS + rational stream time base remain timing authority. No milliseconds/decimal-second canonical fields or destructive correction rewrite were introduced.

## Validation evidence

The code and deterministic tests were batched into one implementation commit to avoid intermediate broken states and unnecessary Actions runs.

AI Editor CI run `32914047941`, job `98013856761`, on exact SHA `92037f27e0a5180e1706fc405d3ff7ecc5e8a148`:

- install dependencies: success
- TypeScript strict gate: success
- Vitest behavioral gate: success
- migration deterministic gate: success
- contract/policy gates: success
- observable commit status: `ai-editor-ci/all = success`

No PostgreSQL/Qdrant local-stack, FFmpeg/media integration, matrix or rerun was used because P3-02 is an in-memory deterministic persistence-semantics slice; those gates are not required by the Bible for this item.

## Preserved contracts

Canonical timeline v1/v2 compatibility, media-time rules, renderer-neutral v2 adapter boundary, style profile, delivery profile, structured logging, provenance/rights work, immutable revision/render evidence, Phase-1 media durability, and Phase-2 scene/proxy/keyframe lineage remain unchanged.

Transcript/model evidence remains untrusted data and corrections remain additive immutable evidence.

## Progress

```text
Standalone verified: 49 / 162 = 30.25%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:     14 / 14  = 100.00%
Phase 2 verified:     11 / 11  = 100.00% + gate evidence
Phase 3 verified:      2 / 9   =  22.22%
```

## Failures / blockers

No correctness gate failed in this slice. No unavailable runner was counted as success or code failure. No unchanged failed job was rerun.

## Next task

P3-03 — PostgreSQL durable transcript revision persistence/readback. Reuse the P3-02 immutable conflict/idempotency semantics, preserve exact media/audio-stream/native-PTS lineage and correction parent evidence, then prove real PostgreSQL round-trip with a selective local-stack runtime gate after static CI passes.
