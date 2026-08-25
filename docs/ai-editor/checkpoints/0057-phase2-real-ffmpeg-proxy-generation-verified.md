# Checkpoint 0057 — Phase 2 real FFmpeg proxy generation verified

Date: 2026-08-26 (Asia/Bangkok)

Starting HEAD: `a93ea2fdd504fec900db91c70b6e706fade2ea70`.

## Required startup audit

This run re-read `PROJECT_BIBLE.md`, `docs/ai-editor/progress.json`, `docs/ai-editor/PROGRESS.md`, `docs/ai-editor/IMPLEMENTATION_MAPPING.md`, checkpoint 0056, exact `main` HEAD and available CI evidence before modifying code.

Starting progress was 42/162 standalone verified and Phase 2 was 6/11. P2-06 had exact normal CI and real PostgreSQL evidence. The smallest dependency-correct unfinished item was the real FFmpeg proxy-generation boundary already recorded by checkpoint 0056.

## Selected slice

P2-07 — **confined shell-free bounded real FFmpeg proxy generation**.

Implementation chain:

- `92c0136a0a820caaa77431f76a0da09433be8547` — initial generator, deterministic tests, runtime verifier and selective gate wiring
- `417d3e73abf8516a7da75083eb5246754e691ceb` — repair TypeScript typing in the test executor harness
- `c2ac01b5676c9bd64a070819d5dc29e7c406fc2c` — harden the bounded 720p FFmpeg runtime fixture and isolate real proxy verification as an observable step

## Semantics

`packages/proxy-library/src/generator.ts` reuses the existing `runBoundedProcess` execution boundary, which starts child processes with `shell:false`, bounded timeout and bounded stdout/stderr. The generator validates immutable proxy revision evidence, accepts only the pinned `proxy-h264-720p-v1` profile, resolves the managed-original read path, confines output beneath a derivative root, requires `artifactUri` to equal that exact rebuildable location and maps the declared source stream explicitly.

The generated H.264 MP4 remains rebuildable derivative state. No proxy PTS, codec presentation time, milliseconds or decimal seconds are introduced into canonical scene/source authority.

## Validation and failure handling

The initial normal CI run `32875314848`, job `97891725945`, failed at TypeScript strict gate because the newly introduced test mock inferred a zero-argument call tuple while the test inspected the process-executor arguments. Vitest and downstream gates were skipped. This was not claimed as a pass and the unchanged commit was not rerun.

The initial selective local-stack run `32875314845`, job `97891726311`, passed Docker, PostgreSQL/Qdrant boot and FFmpeg installation but failed in the combined media/proxy verifier step. This was not treated as runner unavailability or a pass. Because that workflow step combined persistence verifiers with the new real-generation verifier, the failure was not sufficiently isolated to attribute beyond that step.

A local clone/reproduction attempt was also made, but the execution environment could not resolve `github.com`; no local pass is claimed from that unavailable route.

Repair `417d3e7...` replaced the test mock with a typed `ProcessExecutor`; normal CI `32875439391`, job `97892120552`, then passed all normal gates.

Runtime hardening `c2ac01b...` simplified the bounded 720p scale behavior, used a small deterministic real H.264 fixture, and split `verify-real-proxy-generation-runtime.mts` into its own observable workflow step. The exact final SHA then passed both required gates.

### Normal CI

- AI Editor CI run `32875753663`
- job `97893121765`
- TypeScript strict: success
- Vitest: success
- migrations: success
- contract/policy gates: success
- status: `ai-editor-ci/all = success`

### Selective real runtime

- AI Editor Local Stack Gate run `32875753669`
- job `97893122814`
- Docker + PostgreSQL + Qdrant: success
- FFmpeg/ffprobe installation: success
- PostgreSQL media/scene/proxy persistence verifier step: success
- real FFmpeg proxy generation step: success
- API health against real dependencies: success
- status: `ai-editor-local-stack/all = success`

No matrix was added and no unchanged failed job was rerun.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time rules, renderer-neutral v2 adapter boundary, style/delivery profiles, structured logging, provenance/rights, immutable revision/render evidence, Phase-1 ingest durability and Phase-2 scene/proxy persistence remain unchanged.

## Progress

```text
Standalone verified: 43 / 162 = 26.54%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:     14 / 14  = 100.00%
Phase 2 verified:      7 / 11  =  63.64%
```

## Failures / blockers

No remaining correctness blocker for P2-07. The earlier failing commits remain historical evidence only and are not treated as passes.

## Next task

Audit the smallest additive Phase-2 keyframe derivative contract/generation slice. It must remain versioned/rebuildable, bind to immutable scene-set/source authority and native timing, and keep any real extraction selective rather than turning keyframe filenames or derived timestamps into canonical time.
