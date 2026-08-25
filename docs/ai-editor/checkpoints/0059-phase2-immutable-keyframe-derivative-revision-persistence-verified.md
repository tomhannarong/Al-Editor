# Checkpoint 0059 — Phase 2 immutable keyframe derivative revision persistence verified

Date: 2026-08-26 (Asia/Bangkok)

Starting HEAD: `a01c36035097f371952178801adcb267d0cfafa8`.

## Required startup audit

This run re-read `PROJECT_BIBLE.md`, `docs/ai-editor/progress.json`, `docs/ai-editor/PROGRESS.md`, `docs/ai-editor/IMPLEMENTATION_MAPPING.md`, checkpoint 0058, exact `main` HEAD and available CI evidence before modifying code.

Starting progress was 44/162 standalone verified and Phase 2 was 8/11. P2-08 had exact AI Editor CI evidence on implementation SHA `59aa02eddf4357eb289ef244a820c99cd5de95ad`. The smallest dependency-correct unfinished item was immutable keyframe derivative revision persistence/idempotency; repository search found no existing keyframe-library implementation to duplicate.

## Selected slice

P2-09 — **immutable keyframe derivative revision persistence/idempotency**.

Implementation commit: `5ce040aeb14953f126cfe9dee8b22e086dd06775`.

## Semantics

`packages/keyframe-library/src/index.ts` defines an immutable metadata persistence boundary for rebuildable keyframe derivatives.

`revisionId` is immutable evidence identity. Re-registering an exact semantic revision is idempotent, including equivalent rational source time bases after canonical normalization. Reusing the same `revisionId` with changed scene/source lineage, derivative profile, toolchain, creation evidence, frame IDs, native `sourcePts` values or frame artifact URIs fails closed before stored state is mutated.

Returned and stored revisions deep-copy source, toolchain and frame evidence so external callers cannot mutate historical state after registration or readback. A keyframe re-extraction/rebuild that changes frame or artifact evidence therefore requires a new immutable revision.

Native safe-integer frame `sourcePts` plus rational source time base remain source-time authority. No seconds or milliseconds authority was introduced.

## Validation

The implementation was batched into one substantive code commit and used one normal single-job CI confidence gate. No PostgreSQL/Qdrant local-stack, FFmpeg keyframe extraction, matrix or rerun was used because this slice is an in-memory immutable persistence boundary.

- AI Editor CI run `32886479355`
- job `97928027272`
- TypeScript strict gate: success
- Vitest behavioral gate: success
- migration deterministic gate: success
- contract and policy gates: success
- observable commit status: `ai-editor-ci/all = success`

The workflow completed successfully on exact implementation SHA `5ce040aeb14953f126cfe9dee8b22e086dd06775`.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time rules, renderer-neutral v2 adapter boundary, style/delivery profiles, structured logging, provenance/rights work, immutable revision/render evidence, Phase-1 ingest durability, and existing Phase-2 scene/proxy/keyframe source-lineage contracts remain unchanged.

## Progress

```text
Standalone verified: 45 / 162 = 27.78%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:     14 / 14  = 100.00%
Phase 2 verified:      9 / 11  =  81.82%
```

## Failures / blockers

No correctness blocker remains for P2-09. No failed job was skipped and no unchanged failed run was rerun.

## Next task

Implement PostgreSQL durable keyframe derivative revision persistence/readback, reusing P2-09 immutable conflict/idempotency semantics and exact native source mapping. Real FFmpeg keyframe extraction remains the later selective Phase-2 slice after durable evidence is proven.
