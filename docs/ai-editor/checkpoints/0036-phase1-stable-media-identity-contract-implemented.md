# Checkpoint 0036 — Phase 1 stable media identity contract implemented

Date: 2026-08-25 (Asia/Bangkok)

Implementation HEAD: `c68362f7166aba1a33137b89474caa93a8cf163f` (`feat: add stable media asset identity contract`).

## Start-state audit

Read `PROJECT_BIBLE.md`, `docs/ai-editor/progress.json`, `docs/ai-editor/PROGRESS.md`, `docs/ai-editor/IMPLEMENTATION_MAPPING.md`, and prior checkpoint evidence from the Phase-0 closure commit. Exact starting `main` HEAD was `3f8514adfd20af988836bb7cb1991b1bf19722db`.

Repository audit found no existing standalone media-catalog/immutable-ingest package to adapt. Existing canonical media-time/timeline contracts remain the authority for rational time and native source PTS.

## Implemented slice

Added:

- `packages/contracts/src/media-catalog.contract.ts`
- `packages/contracts/src/media-catalog.contract.test.ts`
- export from `packages/contracts/src/index.ts`

The new additive contract enforces:

1. Stable asset identity is content-addressed as `sha256:<digest>` and cannot be path-derived.
2. Mutable storage location is represented separately and references stable `assetId`.
3. Same immutable bytes remain the same asset across move/rename/re-ingest.
4. Normalized stream metadata stores native `startPts`, `durationPts`, stream index and canonical rational `timeBase`.
5. Derived decimal/millisecond timing is intentionally absent from this authority boundary.
6. Invalid digests, unsafe integer timing and invalid rational time bases fail validation.

No canonical v1/v2 contract, renderer boundary, immutable timeline revision, delivery/style/provenance/model contract or FFmpeg `-copyts` behavior was changed.

## Validation/evidence

Local-first clone/test execution was attempted, but the execution container could not resolve `github.com`; therefore no local runtime/test pass is claimed.

The implementation was committed and fast-forwarded directly to `main` once, without a PR or intermediate broken push. At checkpoint time GitHub connector status inspection returned no completed status contexts for `c68362f...`. Consequently this slice is recorded as **implemented-verification-pending**, not verified, and standalone verified totals remain unchanged.

No failed GitHub Actions job was rerun. No manual local-stack/FFmpeg heavy workflow was triggered. The normal repository CI is the intended final confidence gate for this code-bearing commit.

## Progress

```text
Standalone verified: 22 / 162 = 13.58%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1:              started; first contract slice implemented, verification pending
```

## Blocker / next task

Direct dependent implementation is blocked only until exact status evidence for `c68362f...` is observable. On the next run:

- inspect exact CI/status for `c68362f...`;
- if passing, mark this contract slice verified and implement streaming SHA-256 ingest + idempotent asset registration/location rebinding with deterministic persistence tests;
- if failing, repair only the reported code/config cause and do not rerun unchanged failures.
