# AI Local Footage Editor — Progress

**Repository:** `tomhannarong/Al-Editor` / `main`  
**Phase:** 2 — Scene Library, Proxies, Keyframes  
**Current task:** Phase-2 gate reconciliation; do not advance until the Bible quality baseline has exact evidence

```text
Standalone verified: 47 / 162 = 29.01%
Phase 0:             22 / 22  = 100.00% COMPLETE
Phase 1:             14 / 14  = 100.00% COMPLETE
Phase 2:             11 / 11  = 100.00% implementation slices verified; gate reconciliation pending
```

Phase 0 remains verified-complete through P0-22. Phase 1 remains verified-complete through P1-14.

## Phase 2 verified slices

P2-01 through P2-10 remain verified with their existing exact evidence: versioned scene-set source mapping, immutable scene-set persistence/durability, rebuildable proxy contract/persistence/durability, confined bounded real FFmpeg proxy generation, versioned keyframe derivative evidence, immutable keyframe revision semantics, and real PostgreSQL keyframe durability.

### P2-11 — confined shell-free bounded real FFmpeg keyframe extraction

Implementation `57f68a113d15f914d193cb53c9d4df70595eec4c`.

`packages/keyframe-library/src/generator.ts` now extracts keyframe image derivatives from a source that is realpath-confined under the supplied managed-original root. Direct symlink inputs fail closed. The generator reuses the existing shell-free `runBoundedProcess` boundary, validates a bounded frame fan-out before invoking FFmpeg, maps the exact source stream, and drives selection with integer native `sourcePts` values via `select=eq(pts\,...)` while retaining the revision's rational source time base as the interpretation authority.

Caller-controlled `revisionId`/`frameId` values never become filesystem path segments: the revision directory is a SHA-256 digest of the immutable revision ID and frame outputs are ordinal PNG paths. Every declared `artifactUri` must exactly match its confined deterministic output. FFmpeg writes to a unique temporary image and the final path is published without overwriting an existing revision artifact. Image bytes and URIs remain rebuildable derivative state only.

`infra/verify-real-keyframe-extraction-runtime.mts` creates a real 30 fps H.264 MP4 with explicit `1/90000` track time base, verifies that native PTS `0` and `45000` exist, marks the managed input read-only, extracts those exact frames with real FFmpeg, and ffprobes both generated PNGs.

Exact evidence on `57f68a113d15f914d193cb53c9d4df70595eec4c`:

- AI Editor CI run `32899647168`, job `97970214362`: success
- TypeScript strict gate: success
- Vitest behavioral gate: success
- migration deterministic gate: success
- contract/policy gates: success
- `ai-editor-ci/all = success`
- AI Editor Local Stack Gate run `32899647404`, job `97970215910`: success
- PostgreSQL + Qdrant runtime: success
- media catalog / durable ingest / scene / proxy / keyframe PostgreSQL verifier chain: success
- real FFmpeg proxy + keyframe derivative generation: success
- API health against real dependencies: success
- `ai-editor-local-stack/all = success`

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time authority, renderer-neutral v2 adapter boundary, style/delivery/provenance/model contracts, structured logging, immutable revision/render evidence, Phase-1 media durability and Phase-2 exact scene/proxy/keyframe source lineage remain unchanged. Native PTS + rational stream time base remain source-time authority.

## Validation / free-tier discipline

The execution environment could not resolve `github.com`, so a local clone/test run was unavailable and was not claimed as a pass. The implementation was batched into one commit. That exact commit used one normal single-job CI run plus the already-selective single-job local-stack runtime gate; no matrix and no unchanged rerun were used. Proxy and keyframe real-media checks are consolidated into one derivative-generation step. The docs/checkpoint closure is path-filtered and must not trigger Actions.

## Next task

Reconcile the Phase-2 Bible gate directly against `PROJECT_BIBLE.md`: versioned scene sets and exact source mapping already have exact evidence, but Phase 2 must not advance until the required **quality baseline** is mapped to exact standalone evidence. If that evidence is absent, implement the smallest deterministic quality-baseline contract/fixture needed before entering Phase 3.
