# Checkpoint 0049 — Phase 1 real ffprobe durable ingest runtime verified

Date: 2026-08-25 (Asia/Bangkok)

Starting HEAD: `19ae54dfc163fc5d80a05ffe3507e560c80fb5ef`.

## Audit and selected slice

This continuation re-read `PROJECT_BIBLE.md`, `docs/ai-editor/progress.json`, `docs/ai-editor/PROGRESS.md`, `docs/ai-editor/IMPLEMENTATION_MAPPING.md`, checkpoint 0048, exact `main` HEAD and available CI/runtime evidence before changing code.

The Bible's Phase-1 gate requires idempotent content-addressed assets, normalized stream metadata and native timing. The existing P1-11 durable runtime proof exercised real filesystem + real PostgreSQL but substituted a deterministic ffprobe executor. Since P1-07 had separately proved the shell-free bounded process boundary, the smallest remaining runtime gap was proving those layers compose with the real `ffprobe` executable against the verified managed original.

## P1-13 — real ffprobe managed-original durable runtime

Implementation commit `eed8bc827e54bd85d5b4c7d63547a0cce39d9175` (`test: prove durable ingest with real ffprobe media`) upgrades `infra/verify-postgres-durable-ingest-runtime.mts`.

The verifier now:

- generates a small real MP4 fixture from FFmpeg lavfi video + audio sources;
- sends that file through the existing confined local ingest and managed SHA-256 original path;
- invokes the existing durable ingest path without an injected executor, so the default real `ffprobe` executable is used;
- verifies byte equality between source and managed original;
- verifies real video/audio streams, codec identities, positive native rational time bases, native duration PTS and safe/null start PTS;
- verifies video and audio retain their own native stream time bases;
- verifies PostgreSQL asset, source location, managed location and normalized stream readback;
- re-ingests unchanged bytes and proves the same immutable asset/content path and identical normalized streams are reused.

No alternate identity, metadata schema or timing implementation was introduced.

## First runtime attempt and repair

Selective AI Editor Local Stack Gate run `32829451776`, job `97744632786`, reached the media-catalog verifier after Docker, PostgreSQL, Qdrant and the lower-level PostgreSQL runtime proof had already succeeded. It then failed with:

`MediaProcessError: failed to start media process: spawn ffmpeg ENOENT`

The hosted runner did not contain FFmpeg tooling. This was recorded as a runtime tooling/config failure, not as an ingest code failure or pass. The unchanged failed run was not rerun.

Repair commit `f9d843684c30a7e689d59ed4d936545af807225e` (`fix: install ffmpeg for real media runtime gate`) changes only the selective local-stack workflow to install FFmpeg/ffprobe before the runtime verifier. Normal CI was not triggered.

## Exact repaired validation evidence

AI Editor Local Stack Gate:

- run: `32829569480`
- job: `97744989990`
- exact repaired SHA: `f9d843684c30a7e689d59ed4d936545af807225e`
- deterministic verifier control flow: success
- API health deterministic contract: success
- Docker runtime: success
- PostgreSQL + Qdrant real runtime health: success
- FFmpeg runtime tools: success (`ffmpeg 6.1.1-3ubuntu5`, `ffprobe 6.1.1-3ubuntu5`)
- PostgreSQL migration/catalog atomic commit+rollback verifier: success
- real-media durable ingest verifier: success
- API health against real PostgreSQL/Qdrant: success
- cleanup: success
- observable status publication: success
- exact status: **`ai-editor-local-stack/all = success`**

The verifier's success line was:

`Durable immutable local ingest real-media proof passed: generated FFmpeg fixture, confined source hashing, verified content-addressed managed original, real ffprobe native stream metadata, atomic PostgreSQL commit, and idempotent re-ingest.`

## Free-tier discipline

Only the selective local-stack workflow was triggered for this runtime-only slice. The first attempt exposed a concrete missing executable and was not rerun unchanged; a workflow repair produced a fresh run. No normal CI, matrix or broad real-media test suite was added.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time authority, renderer-neutral v2 adapter boundary, style profile, delivery profile, structured logging, provenance/rights, immutable revision/render evidence and FFmpeg `-copyts` behavior remain unchanged.

Stable media identity remains SHA-256 byte-derived and separate from mutable storage location. Native integer PTS plus rational stream time base remain the sole source timing authority; ffprobe decimal seconds remain non-authoritative.

## Progress

```text
Standalone verified: 35 / 162 = 21.60%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:     13 / 14  = 92.86%
```

## Next task

Perform the final Phase-1 gate reconciliation against the Bible's explicit idempotent content-addressed asset, normalized stream metadata, native timing and immutable-original requirements. Audit the last checklist item without inventing new semantics. If the existing exact evidence covers the full phase gate, record explicit Phase-1 closure before starting the smallest dependency-correct Phase-2 scene-library slice.
