# Checkpoint 0037 — Phase 1 content-addressed ingest verified

Date: 2026-08-25 (Asia/Bangkok)

Starting `main` HEAD: `a162ad4b1112116d217d674d7d33ac06fe519039`.

## Start-state audit

Read `PROJECT_BIBLE.md`, `docs/ai-editor/progress.json`, `docs/ai-editor/PROGRESS.md`, `docs/ai-editor/IMPLEMENTATION_MAPPING.md`, and checkpoint `0036-phase1-stable-media-identity-contract-implemented.md` before implementation.

Exact prior implementation evidence became observable during this run: commit `c68362f7166aba1a33137b89474caa93a8cf163f` has `ai-editor-ci/all = success`, run `32772298608`. Therefore the stable media identity contract is now verified rather than pending.

## Implemented slice

Commit `2cba444a4890b81eb565ca22687fd8e7c2d43a86` (`feat: add content-addressed media ingest`) added:

- `packages/media-catalog/src/index.ts`
- `packages/media-catalog/src/index.test.ts`

The implementation provides incremental SHA-256 over sync/async byte chunks, idempotent content-addressed asset registration, mutable location rebinding, preservation of original first-ingest evidence, and defensive-copy persistence behavior. Tests cover known SHA-256 output, chunk-boundary independence, async streams, byte-identical re-ingest, rename/location changes, changed bytes at a known location, and mutation isolation.

No canonical timeline v1/v2, media-time conversion, renderer boundary, immutable revision evidence, delivery/style/provenance/model contract, or FFmpeg native-PTS behavior was changed.

## Gate failure and repair

Run `32776611559` for `2cba444a...` reached a real runner but failed the strict TypeScript gate; later gates were skipped. The failed run was not rerun unchanged.

The new TypeScript source imports Node's `node:crypto`; the repository previously had no explicit Node type dependency. Repair commit `b820fc809f99f438b8ff7b8681c6b983e26122ee` (`fix: add node types for streaming ingest`) added `@types/node` to devDependencies. This is a concrete dependency/config correction, not a blind Actions retry.

Exact final evidence: `ai-editor-ci/all = success` for `b820fc809f99f438b8ff7b8681c6b983e26122ee`, run `32776732634`. This verifies the strict TypeScript, Vitest behavioral, migration, and contract/policy gates on the repaired implementation head.

Local clone/test execution was attempted again, but the execution container could not resolve `github.com`; therefore no local pass is claimed. No heavyweight FFmpeg/media or local-stack workflow was manually triggered.

## Progress

Historical phase inventory records Phase 1 as 14 checklist items. This run closes the first two standalone Phase-1 slices:

```text
Standalone verified: 24 / 162 = 14.81%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:      2 / 14  = 14.29%
```

## Next task

Implement normalized ffprobe stream-metadata ingestion behind the verified media-catalog boundary. Preserve integer native PTS and rational stream time base as authority, reject malformed/unsafe timing, and keep seconds/milliseconds derived-only. Use deterministic parser fixtures first and defer heavyweight real-media validation until required by the Phase-1 runtime gate.
