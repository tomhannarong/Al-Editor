# AI Local Footage Editor — Progress

**Authority:** `PROJECT_BIBLE.md` + `docs/ai-editor/progress.json`  
**Repository:** `tomhannarong/Al-Editor`  
**Working branch:** `main`  
**Current phase:** Phase 0 — Foundation, Contracts and Reproducibility  
**Current task:** obtain one exact-main GitHub CI evidence run for P0-15 after local validation passed; do not begin P0-18 before that gate

## Overall historical verified baseline

```text
20 / 162 historically verified before repository split
[██░░░░░░░░░░░░░░░░░░░] 12.35%
```

This number is preserved as migration provenance from the former `creator-intelligence-os` integration. It is **not** a claim that all 20 items have already been revalidated on standalone `Al-Editor/main`.

## Standalone migration state

The new repository is authoritative. New implementation work is committed directly to `main`; pull requests are not required.

Standalone revalidation remains `0 / 162` because P0-15 has passed local executable validation but still lacks observable exact-main GitHub CI evidence.

## Phase progress baseline

```text
P00 Foundation / Contracts       20/22 historical baseline  90.9%  MIGRATING / REVALIDATING
P01 Media Catalog                 0/14                       0.0%  audit pending
P02 Scene Library                 0/11                       0.0%  audit pending
P03 Voice Alignment               0/09                       0.0%  audit pending
P04 Baseline Retrieval            0/10                       0.0%  audit pending
P05 Hybrid Retrieval              0/09                       0.0%  audit pending
P06 Timeline + Render             0/12                       0.0%  audit pending
P07 Human Review                  0/10                       0.0%  audit pending
P08 Editorial Brain               0/09                       0.0%  audit pending
P09 Evaluation / Learning         0/09                       0.0%  audit pending
P10 OTIO / DaVinci                0/08                       0.0%  audit pending
P11 Advanced Video AI             0/08                       0.0%  audit pending
P12 Content Agent                 0/08                       0.0%  audit pending
P13 Production Hardening          0/14                       0.0%  audit pending
P14 Distribution Outcomes         0/09                       0.0%  audit pending
```

## Current gate — P0-15

P0-15 Asset Provenance / Rights Schema v1 is migrated with TypeScript contract, JSON Schema, focused validation tests and package export.

Local validation for the exact migrated contract passed on 2026-08-24:

```text
strict TypeScript compile: PASS
P0-15 local smoke: PASS (5 cases)
```

The smoke cases cover a cleared owned asset, fail-closed unknown clearance, licensed-without-evidence rejection, obtained-consent-without-evidence rejection and malformed SHA-256 rejection.

P0-15 remains **not VERIFIED** until exact-main CI evidence is observable.

## GitHub Actions free-tier policy

The main CI workflow has been reduced to one bounded validation job. It now:

- runs only for code/config paths relevant to executable validation, plus manual dispatch;
- does not run for progress/checkpoint/documentation-only commits;
- uses concurrency cancellation so superseded runs are stopped;
- uses an 8-minute hard timeout;
- does not enable npm cache until a lockfile exists;
- avoids matrices and heavyweight media integration in the ordinary commit loop.

A concrete scaffold issue was found and repaired: the previous workflow enabled `actions/setup-node` npm caching even though the repository has no `package-lock.json`.

## Next smallest task

Inspect the single CI run associated with the optimized workflow/code state. If it fails, repair P0-15/scaffold only. If it passes, promote P0-15 and begin P0-18. Do not rerun unchanged failures and do not spend an Actions run for documentation-only evidence.
