# Checkpoint 0038 — Phase 1 normalized ffprobe metadata implemented, exact gate pending

Date: 2026-08-25 (Asia/Bangkok)

Starting `main` HEAD: `b66ca3ec1cc2f3266e66c45e6dfad0983f61e539`.

## Start-state audit

Read `PROJECT_BIBLE.md`, `docs/ai-editor/progress.json`, `docs/ai-editor/PROGRESS.md`, `docs/ai-editor/IMPLEMENTATION_MAPPING.md`, and checkpoint `0037-phase1-content-addressed-ingest-verified.md`. Exact prior CI evidence remained valid: `b820fc809f99f438b8ff7b8681c6b983e26122ee` has successful AI Editor CI run `32776732634`; the docs-only checkpoint commit created no later normal CI run.

## Implemented slice

Commit `705e1dc8c1b348b5b2189f23a239969368434412` (`feat: normalize ffprobe native stream metadata`) updates only the media-catalog implementation/tests.

It adds deterministic ffprobe stream normalization using native `time_base`, `start_pts`, and `duration_ts`; decimal `start_time`/`duration` fields are not consumed as timing authority. It also normalizes stream kind/codec, dimensions, sample rate and channel count, sorts by stream index, rejects duplicate indexes, rejects malformed rationals and unsafe/decimal integer timing, and maps ffprobe `N/A` native timing to explicit `null`.

The persistence boundary now replaces the normalized stream projection for a registered immutable asset, validates every stream through the existing contract, rejects cross-asset/duplicate identities, and returns defensive copies. Tests cover video/audio streams with distinct time bases and non-zero PTS, contradictory seconds fields, `N/A`, malformed/unsafe timing, duplicate indexes, replacement semantics, unknown-asset rejection, and mutation isolation.

No canonical timeline v1/v2 compatibility, media-time rounding authority, renderer-neutral boundary, immutable revision/render evidence, style/delivery/provenance/model contracts or FFmpeg `-copyts` semantics changed.

## Validation and free-tier discipline

Local clone/test execution was attempted before claiming verification, but the execution environment still could not resolve `github.com`; no local runtime pass is claimed. Repository/static inspection found no separate `MediaCatalogPersistence` implementation requiring a coordinated migration.

The code was pushed once as one coherent implementation commit. No heavyweight FFmpeg, PostgreSQL or Qdrant workflow was triggered. The normal code-path CI is the intended final confidence gate. At checkpoint time the available exact-commit status endpoint had not yet published an `ai-editor-ci/*` status for `705e1dc8...`; therefore this slice is implemented but not marked verified, and no unchanged job was rerun.

## Progress

```text
Standalone verified: 24 / 162 = 14.81%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:      2 / 14  = 14.29%
P1-03: implemented, exact CI evidence pending
```

## Next task

Inspect exact CI/status for `705e1dc8c1b348b5b2189f23a239969368434412`. If successful, mark P1-03 verified and proceed to the next smallest Phase-1 item. If it fails, repair only the reported code/config cause; never rerun the unchanged failed job.
