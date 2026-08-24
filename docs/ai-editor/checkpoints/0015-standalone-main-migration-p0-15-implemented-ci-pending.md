# Checkpoint 0015 — Standalone `Al-Editor/main` migration + P0-15 implementation

Date: 2026-08-24 (Asia/Bangkok)

## Repository switch

Active implementation repository is now `tomhannarong/Al-Editor` and the active branch is `main`. AI Editor work is committed directly to `main`; pull requests are not required.

The hourly `AI Editor Build Loop` automation has been updated to read/write this repository and to enforce exact-`main` evidence, failed-gate blocking and direct-main commits.

## Authority migrated

Added/updated:

- `README.md` with direct link to `PROJECT_BIBLE.md` and direct-main policy;
- `PROJECT_BIBLE.md` revision `1.2-standalone-ai-editor`;
- `docs/ai-editor/progress.json`;
- `docs/ai-editor/PROGRESS.md`;
- `docs/ai-editor/IMPLEMENTATION_MAPPING.md`.

Historical `20 / 162` verified progress is preserved only as migration provenance. Standalone revalidation starts from zero and must bind code/tests/CI evidence to `tomhannarong/Al-Editor` exact `main` HEAD.

## P0-15 migrated implementation

Added:

- `package.json` with pinned TypeScript/Vitest development dependencies;
- strict `tsconfig.json`;
- `packages/contracts/src/asset-provenance.contract.ts`;
- `packages/contracts/src/index.ts`;
- `packages/contracts/schemas/asset-provenance.v1.json`;
- `packages/contracts/test/asset-provenance.spec.ts`;
- `.github/workflows/ci.yml` for direct-main typecheck + test validation.

The provenance contract preserves the fail-closed publication rules from the former implementation: unknown/unreviewed provenance may be stored, but a `cleared` claim requires a known rights basis, durable review, and explicit commercial + derivative-use allowance. License/permission, attribution and consent evidence remain conditionally required.

## Exact-head evidence

Implementation/CI workflow HEAD before this checkpoint: `f01bd74dfeb1521dd07a5cacfedb923e069ee043`.

GitHub combined status inspection returned no status contexts yet for that exact HEAD. Therefore P0-15 is **not VERIFIED** in the standalone repository at this checkpoint.

## Gate decision

Do not begin P0-18 until exact-main P0-15 validation has executable evidence. Next run must inspect CI for the current `main` HEAD; if CI fails, repair P0-15/scaffold only. If CI passes, promote P0-15 and continue with P0-18.
