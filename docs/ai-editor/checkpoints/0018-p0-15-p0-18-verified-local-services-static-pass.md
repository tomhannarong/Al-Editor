# Checkpoint 0018 — P0-15/P0-18 verified; local services static-pass

Date: 2026-08-24 (Asia/Bangkok)

## Starting state

Exact `main` HEAD at run start: `ecd2f3b26cdcc9c1f0c9ce1180bf783d4a8ebde7`.

P0-15 was implemented and locally green but incorrectly blocked on repository-wide CI observation. P0-18 was blocked by that coupling.

## Re-read authorities

Re-read the standalone Bible, progress authority, human progress view, implementation mapping and checkpoint 0017 before changing state.

The original full Bible source was also consulted to recover the exact accepted decisions for ADR-008 through ADR-011:

- ADR-008 — canonical editorial time uses rational frames + native source PTS;
- ADR-009 — media color/audio/caption delivery policy is versioned;
- ADR-010 — provenance/rights is first-class domain data;
- ADR-011 — media/model content is untrusted data.

## Gate correction

P0-15 is a contract/schema checklist item. Its direct evidence is strict compilation plus focused contract validation. Repository-wide GitHub CI is a separate P0-20 checklist item. Requiring P0-20 evidence to promote P0-15 created a redundant dependency and conflicted with the free-tier policy.

Existing direct local evidence from the preceding run remains:

```text
strict TypeScript compile: PASS
P0-15 focused local smoke: PASS (5 cases)
```

No unavailable GitHub Actions result was reclassified as pass. P0-20 remains partial/CI-evidence-pending.

## Completed this run

Standalone verified:

- P0-01 — repository structure committed;
- P0-02 — root README links `PROJECT_BIBLE.md`;
- P0-15 — provenance/rights schema contract, by direct local contract evidence;
- P0-18 — ADR-008 through ADR-011 accepted/adapted in `docs/adr/`.

Standalone revalidation is now `4 / 162` (2.47%); Phase 0 standalone revalidation is `4 / 22` (18.18%). Historical migration provenance remains `20 / 162` and is not double-counted as standalone verification.

## Next task started — P0-03/P0-04

Added:

- `infra/docker-compose.yml`;
- `infra/.env.example`.

The compose file defines pinned PostgreSQL `17.6-alpine` and Qdrant `v1.15.4`, persistent named volumes, configurable ports and health checks.

Static YAML parse: **PASS**.

Runtime service boot: **NOT EXECUTED** because this execution environment has no Docker CLI (`docker: command not found`). This is an environment/tooling limitation, not a PostgreSQL/Qdrant failure.

Therefore P0-03 and P0-04 are `implemented-static-pass-runtime-boot-pending`. P0-05 remains blocked.

## GitHub Actions usage

No Actions rerun was requested. Current normal CI path filters do not include ADR/progress/infra paths, so this run does not intentionally spend Actions minutes for documentation or local-stack scaffolding.

## Ending state before this checkpoint commit

Latest implementation/documentation HEAD before adding this checkpoint: `42bbc99b51020942a0d333fa9685502b1a6836a2`.

## Next run

First inspect whether Docker/runtime service validation is available. If available, run compose config/boot/health checks for PostgreSQL and Qdrant and promote P0-03/P0-04 only on executable success. If Docker remains unavailable, preserve the blocker and do not begin P0-05.
