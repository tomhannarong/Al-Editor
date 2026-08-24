# Checkpoint 0039 — Phase 1 normalized ffprobe native metadata verified

Date: 2026-08-25 (Asia/Bangkok)

Starting implementation HEAD for this slice: `705e1dc8c1b348b5b2189f23a239969368434412`.

## Exact verification evidence

The normal repository validation workflow published `ai-editor-ci/all = success` for exact implementation commit `705e1dc8c1b348b5b2189f23a239969368434412`, run `32782942297`.

Workflow job `97608726144` completed successfully, including dependency install, strict TypeScript gate, Vitest behavioral gate, deterministic migration gate, contract/policy gates, and observable commit-status publication.

Therefore P1-03 — normalized ffprobe native stream metadata — is now verified.

## Verified behavior

- ffprobe `time_base`, `start_pts`, and `duration_ts` are normalized into rational/native-integer timing authority;
- decimal `start_time` and `duration` are intentionally ignored;
- malformed rationals, decimal or unsafe PTS values, invalid positive metadata, and duplicate stream indexes fail closed;
- ffprobe `N/A` native timing becomes explicit `null` rather than fabricated seconds;
- stream projections can only be persisted for registered immutable assets;
- replacement semantics remove stale stream projections and defensive copies protect persisted state.

No canonical timeline v1/v2, centralized media-time conversion, renderer-neutral adapter, style/delivery/provenance/model contract, immutable revision/render evidence, or FFmpeg `-copyts` semantics changed.

## Local/static validation note

A local clone/test attempt before push failed because the execution environment could not resolve `github.com`; that is not counted as a test pass or code failure. GitHub Actions was used once as the final confidence gate for the coherent code commit. No heavyweight FFmpeg, PostgreSQL, or Qdrant workflow was triggered, and no unchanged failed job was rerun.

## Progress

```text
Standalone verified: 25 / 162 = 15.43%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:      3 / 14  = 21.43%
```

## Next task

Implement PostgreSQL-backed durable media-catalog persistence for immutable assets, mutable locations, and normalized stream metadata behind the verified media-catalog interfaces. Reuse the existing migration framework and preserve native PTS/rational time-base authority; keep real PostgreSQL runtime proof selective until required by the Phase-1 persistence/runtime gate.
