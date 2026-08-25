# Checkpoint 0058 — Phase 2 keyframe derivative contract verified

Date: 2026-08-26 (Asia/Bangkok)

Starting HEAD: `b204ae74dd012fcb18d743a1c170ab902c4a05c8`.

## Required startup audit

This run re-read `PROJECT_BIBLE.md`, `docs/ai-editor/progress.json`, `docs/ai-editor/PROGRESS.md`, `docs/ai-editor/IMPLEMENTATION_MAPPING.md`, checkpoint 0057, exact `main` HEAD and available CI evidence before modifying code.

Starting progress was 43/162 standalone verified and Phase 2 was 7/11. P2-07 had exact normal CI and selective real FFmpeg/local-stack evidence. The smallest dependency-correct unfinished item was the additive keyframe derivative contract; repository search found no existing keyframe implementation to duplicate.

## Selected slice

P2-08 — **versioned rebuildable keyframe derivative contract**.

Implementation commit: `59aa02eddf4357eb289ef244a820c99cd5de95ad`.

## Semantics

`packages/contracts/src/keyframe-derivative.contract.ts` defines immutable revision evidence for rebuildable keyframe images. Each revision binds to exact `sceneSetId`, `sceneSetRevisionId`, `sceneId`, canonical SHA-256 asset identity, source stream identity/index and normalized rational source time base.

Every extracted frame carries a safe-integer native `sourcePts`; source PTS values and frame IDs must be unique, and source PTS values must be strictly increasing. An artifact URI is required as rebuildable derivative location only. Filename-encoded times, image paths and display/decoded timestamps are explicitly not canonical timing authority.

Derivative profile and toolchain versions are explicit. Source equality deliberately excludes frame selection, profile/toolchain and artifact location state, so a rebuild can produce a new immutable derivative revision without silently changing source lineage.

## Validation

A local clone was attempted first, but the execution environment could not resolve `github.com`. No local/static pass is claimed from that unavailable route.

One normal final-confidence workflow run was used; no PostgreSQL/Qdrant local-stack, FFmpeg extraction, matrix or rerun was needed.

- AI Editor CI run `32881831056`
- job `97912919380`
- TypeScript strict gate: success
- Vitest behavioral gate: success
- migration deterministic gate: success
- contract and policy gates: success
- observable commit status: `ai-editor-ci/all = success`

The workflow completed successfully on exact implementation SHA `59aa02eddf4357eb289ef244a820c99cd5de95ad`.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time rules, renderer-neutral v2 adapter boundary, style/delivery profiles, structured logging, provenance/rights work, immutable revision/render evidence, Phase-1 ingest durability and existing Phase-2 scene/proxy evidence remain unchanged.

## Progress

```text
Standalone verified: 44 / 162 = 27.16%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:     14 / 14  = 100.00%
Phase 2 verified:      8 / 11  =  72.73%
```

## Failures / blockers

No correctness blocker remains for P2-08. Local clone unavailability was not treated as a pass or code failure.

## Next task

Implement immutable keyframe derivative revision persistence/idempotency. Exact semantic re-registration should be idempotent while conflicting reuse of the same `revisionId` must fail closed before mutation. PostgreSQL durability and real FFmpeg extraction remain later selective slices.
