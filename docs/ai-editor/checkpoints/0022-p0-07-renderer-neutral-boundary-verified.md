# Checkpoint 0022 — P0-07 Renderer-neutral adapter boundary verified

Date: 2026-08-24 (Asia/Bangkok)

## Starting state

P0-06 was verified immediately before this slice. P0-03/P0-04 remain runtime-blocked and P0-05 remains their direct dependent.

Historical CIOS evidence included an FFmpeg rough-cut v2 adapter that consumes canonical integer-frame/native-PTS timing. That concrete implementation depends on canonical timeline/media-time contracts that have not yet been migrated into standalone `Al-Editor`.

## Dependency-safe migration

Instead of copying the concrete adapter early and duplicating its dependencies, this run migrated the renderer-neutral boundary first:

- `packages/contracts/src/renderer-adapter.contract.ts`;
- export from `packages/contracts/src/index.ts`;
- `scripts/verify-renderer-boundary.mjs`;
- `docs/adr/ADR-012-RENDERER-ADAPTER-BOUNDARY.md`.

The typed request binds adapter/version, timeline revision + manifest identity, output artifact + delivery profile and three fixed authorities: canonical timeline timing, confined resolved source paths and FFmpeg/FFprobe final compliance.

## Local evidence

Executed before commit:

```text
tsc --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --noEmit renderer-adapter.contract.ts
PASS

node scripts/verify-renderer-boundary.mjs
PASS: renderer-neutral boundary markers verified (7 markers)
```

## Gate decision

P0-07 is VERIFIED from direct typed-boundary + ADR + local compile/static-verifier evidence. The concrete FFmpeg v2 adapter remains intentionally deferred until P0-09/P0-10 are present, so this verification does not invent or duplicate timing semantics.

Standalone progress becomes:

```text
Overall: 6 / 162 = 3.70%
Phase 0: 6 / 22 = 27.27%
```

Next independent Phase-0 task: P0-08 Migration framework.

## GitHub Actions usage

This code commit may trigger/supersede a single minimized validation run. No manual rerun/dispatch is requested. P0-20 remains repository-wide CI authority.
