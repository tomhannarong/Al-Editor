# AI Local Footage Editor — Progress

**Authority:** `PROJECT_BIBLE.md` + `docs/ai-editor/progress.json`  
**Repository:** `tomhannarong/Al-Editor`  
**Working branch:** `main`  
**Current phase:** Phase 0 — Foundation, Contracts and Reproducibility  
**Current task:** validate the local PostgreSQL + Qdrant stack at runtime; do not advance to P0-05 until the services boot and health checks pass

## Historical migration provenance

```text
20 / 162 historically verified before repository split
[██░░░░░░░░░░░░░░░░░░░] 12.35%
```

This is retained as provenance only; it is not standalone `Al-Editor/main` verification.

## Standalone revalidation

```text
4 / 162 standalone-revalidated
[█░░░░░░░░░░░░░░░░░░░░] 2.47%

Phase 0
4 / 22 standalone-revalidated
[████░░░░░░░░░░░░░░░░] 18.18%
```

Standalone-verified this run:

- **P0-01** — repository structure is committed on `main`.
- **P0-02** — root `README.md` links directly to `PROJECT_BIBLE.md`.
- **P0-15** — provenance/rights contract is accepted from direct local contract evidence: strict TypeScript compile passed and focused P0-15 smoke validation passed 5 cases. Repository-wide CI remains a separate P0-20 gate and is not required redundantly for this contract item.
- **P0-18** — ADR-008 through ADR-011 are now accepted/adapted in `docs/adr/`.

## P0-15 evidence rule correction

The previous checkpoint accidentally coupled P0-15 contract verification to P0-20 repository CI evidence. That creates an unnecessary deadlock and spends Actions minutes for redundant evidence. The corrected ownership is:

```text
P0-15 provenance/rights contract
  -> strict compile + focused contract tests

P0-20 repository CI gate
  -> GitHub Actions / migration / repository-wide release evidence
```

No unavailable Actions result has been claimed as a pass.

## P0-03 / P0-04 current gate

Added `infra/docker-compose.yml` with pinned local services:

- PostgreSQL `17.6-alpine` with `pg_isready` health check;
- Qdrant `v1.15.4` with HTTP health check;
- named persistent volumes;
- configurable local ports and an `infra/.env.example`.

Static YAML parsing passes. Runtime validation does **not** pass yet because the current execution environment has no Docker CLI (`docker: command not found`). This is an environment/tooling limitation, not a service failure.

Therefore:

- P0-03 = `implemented-static-pass-runtime-boot-pending`
- P0-04 = `implemented-static-pass-runtime-boot-pending`
- P0-05 remains blocked until the local service gate is executable and green.

## GitHub Actions free-tier policy

Normal CI remains one bounded path-filtered job with concurrency cancellation. Documentation, ADR, progress and `infra/**` changes in this run do not trigger the current Actions workflow. No Actions rerun was spent on unchanged evidence.

## Next smallest task

At the next run, first inspect whether Docker/runtime service validation is available. If available, run compose config/boot/health checks for PostgreSQL and Qdrant. If unavailable, keep P0-03/P0-04 blocked and do not begin P0-05.
