# Checkpoint 0032 — P0-20 CI root cause repaired and verified

Date: 2026-08-25 (Asia/Bangkok)

Starting checkpoint HEAD: `8d51c236fb44c68c1672d755a202b3564a05cd65`. User-visible Actions evidence showed push runs #12–#14 failing while an earlier structured-logging run was green.

## Investigation

No old workflow was rerun. The existing single job was split into named steps without adding jobs or matrices, and an observable commit-status context was added so push-triggered runs can be inspected through the connected GitHub API.

Diagnostic commit `2e68ade9189a124d830fff80d11cc39508314053` produced run `32763431696` with `ai-editor-ci/typecheck = failure`.

The exact job log showed:

```text
packages/contracts/src/index.ts(5,15): error TS2307: Cannot find module './durable-job.contract.js'
packages/contracts/src/index.ts(6,15): error TS2307: Cannot find module './structured-log.contract.js'
```

Both were stale barrel filenames. The real standalone files are `job-state-machine.contract.ts` and `ai-editor-observability.contract.ts`.

## Repair

Commit `dcfd194f5916e31cc6f8388ef604f0e8e9c466ec` changed only the two incorrect exports. No job-state or logging semantics were modified.

## Exact-head evidence

GitHub Actions run `32763513474` on `dcfd194f5916e31cc6f8388ef604f0e8e9c466ec` completed successfully. Job `validate` passed install, strict TypeScript, Vitest behavioral tests, deterministic migration validation, all contract/policy self-tests and observable status publication. Commit status is `ai-editor-ci/all = success`.

P0-20 is VERIFIED. Standalone progress becomes `17/162 = 10.49%`; Phase 0 becomes `17/22 = 77.27%`.

P0-03/P0-04 remain runtime-pending; P0-05 remains their direct dependent. Next independent task: P0-21 canonical-v2 preview walking skeleton.
