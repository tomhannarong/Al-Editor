# Checkpoint 0061 — Phase 2 real FFmpeg keyframe extraction verified

Date: 2026-08-26 (Asia/Bangkok)

Starting HEAD: `35a312671cb5a52f80dd5506365fe122ee1c314e`.

## Required startup audit

This run re-read `PROJECT_BIBLE.md`, `docs/ai-editor/progress.json`, `docs/ai-editor/PROGRESS.md`, `docs/ai-editor/IMPLEMENTATION_MAPPING.md`, checkpoint 0060, exact `main` HEAD and available CI evidence before modifying code.

Starting progress was 46/162 standalone verified and Phase 2 was 10/11. P2-10 had exact `ai-editor-ci/all = success` and `ai-editor-local-stack/all = success` evidence on implementation SHA `bc8431dffaf8a5c2d682b779557b46f004508e92`. The smallest dependency-correct unfinished item was the final planned Phase-2 implementation slice: confined shell-free bounded real FFmpeg keyframe extraction.

## Selected slice

P2-11 — **confined shell-free bounded real FFmpeg keyframe extraction**.

Implementation commit: `57f68a113d15f914d193cb53c9d4df70595eec4c`.

## Implementation

- `packages/keyframe-library/src/generator.ts`
  - validates the immutable keyframe revision before side effects;
  - supports the explicit `keyframe-png-v1` derivative profile and FFmpeg toolchain;
  - rejects direct symlink source inputs and realpath-confines the source under the supplied managed-original root;
  - bounds frame fan-out plus per-process timeout/stdout/stderr;
  - reuses the existing shell-free `runBoundedProcess` executor;
  - maps the exact source stream and uses exact safe-integer native `sourcePts` in FFmpeg `select=eq(pts\,...)` expressions;
  - hashes `revisionId` for the derivative directory and uses ordinal frame filenames so untrusted IDs cannot become path segments;
  - requires every `artifactUri` to equal the confined deterministic output URI;
  - writes to unique temporary PNGs and publishes final files without overwriting an existing immutable revision artifact.
- `packages/keyframe-library/src/generator.test.ts`
  - verifies exact shell-free FFmpeg argument construction and native PTS selectors;
  - verifies artifact-URI confinement fails closed;
  - verifies frame fan-out is rejected before executor invocation.
- `infra/verify-real-keyframe-extraction-runtime.mts`
  - creates a real 30 fps H.264 MP4 with explicit `1/90000` track time base;
  - verifies native frame PTS `0` and `45000` are present before extraction;
  - marks the managed input read-only;
  - extracts both exact frames with real FFmpeg;
  - ffprobes the two generated PNGs and verifies codec/dimensions/non-empty artifacts.
- `.github/workflows/local-stack-gate.yml`
  - includes the new runtime verifier in the existing single selective job;
  - consolidates proxy + keyframe real-media checks into one derivative-generation step;
  - retains concurrency cancellation and no matrix.

## Validation

A local clone/test attempt was made first, but the execution environment could not resolve `github.com`. That environmental limitation was not treated as a pass or code failure.

The implementation was batched into one commit; no intermediate broken push and no unchanged rerun were used.

### AI Editor CI

- run `32899647168`
- job `97970214362`
- TypeScript strict gate: success
- Vitest behavioral gate: success
- migration deterministic gate: success
- contract and policy gates: success
- observable commit status: `ai-editor-ci/all = success`

### AI Editor Local Stack Gate

- run `32899647404`
- job `97970215910`
- deterministic verifier control flow: success
- API health contract: success
- Docker runtime: success
- PostgreSQL + Qdrant runtime: success
- PostgreSQL media catalog / durable ingest / scene / proxy / keyframe verifier chain: success
- real FFmpeg proxy + keyframe derivative generation: success
- API health against real dependencies: success
- cleanup/status publication: success
- observable commit status: `ai-editor-local-stack/all = success`

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time rules, renderer-neutral v2 adapter boundary, style/delivery profiles, structured logging, provenance/rights work, immutable revision/render evidence, Phase-1 ingest durability and existing Phase-2 scene/proxy/keyframe source-lineage contracts remain unchanged.

Native source PTS + rational stream time base remain authoritative. Generated PNG bytes and artifact URIs are rebuildable derivative state only.

## Progress

```text
Standalone verified: 47 / 162 = 29.01%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:     14 / 14  = 100.00%
Phase 2 slices:       11 / 11  = 100.00% verified
```

Phase 2 is intentionally not marked gate-complete yet.

## Failures / blockers

No correctness blocker remains for P2-11. No failed gate was skipped. No unavailable runner was treated as a pass or code failure. No unchanged failed run was rerun.

The only remaining Phase-2 advancement question is Bible gate reconciliation: `PROJECT_BIBLE.md` requires `versioned scene sets, exact source mapping, quality baseline`. Versioned scene sets and exact source mapping have exact standalone evidence. The required quality baseline must still be mapped to exact evidence or implemented before Phase 3 starts.

## Next task

Reconcile the Phase-2 Bible gate. Do not advance to Phase 3 until the `quality baseline` requirement is backed by exact standalone evidence; if it is absent, implement the smallest deterministic quality-baseline contract/fixture and validate it without changing canonical timing contracts.
