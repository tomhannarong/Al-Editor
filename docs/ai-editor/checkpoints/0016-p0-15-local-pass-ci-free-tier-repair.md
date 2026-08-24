# Checkpoint 0016 — P0-15 local pass + GitHub Actions free-tier repair

Date: 2026-08-24 (Asia/Bangkok)

## Starting state

Exact `main` HEAD at run start: `b00ef2be87685ca797fea25759ebc832dda71d28`.

P0-15 was implemented but not standalone-verified because the repository had no observable exact-head executable CI evidence. P0-18 remained blocked.

## CI diagnosis

The repository's `package.json` pins TypeScript 5.9.2 and Vitest 3.2.4 and exposes `npm run validate` as `typecheck && test`.

The CI workflow enabled `actions/setup-node` with `cache: npm`, but the repository currently has no `package-lock.json`. This made cache setup an unnecessary pre-test failure risk and violated the new free-tier policy.

## Repair committed directly to main

Commit `6dc52e8cdd4d004b36130be536b32e7490b6951d` updates `.github/workflows/ci.yml` to:

- run automatically only for executable code/config paths;
- skip progress/checkpoint/documentation-only changes;
- keep manual `workflow_dispatch`;
- cancel superseded in-progress validation via concurrency;
- hard-limit the validation job to 8 minutes;
- remove npm cache until a lockfile exists;
- retain a single Node 22 validation job.

No matrix or heavyweight media integration was added.

## Local executable evidence

Because GitHub status APIs exposed no direct-push Actions check context, the P0-15 contract was independently validated locally before any further implementation work.

Environment:

```text
Node.js 22.16.0
TypeScript 5.8.3 (local runner)
```

Results:

```text
strict TypeScript compile: PASS
P0-15 local smoke: PASS (5 cases)
```

The smoke assertions covered:

1. reviewed owned asset explicitly cleared for commercial derivative publication;
2. fail-closed unknown/non-explicit clearance;
3. licensed basis without license evidence;
4. obtained consent without durable evidence;
5. malformed SHA-256 digest.

## Exact-head observation

Combined status inspection for `6dc52e8cdd4d004b36130be536b32e7490b6951d` returned no legacy status contexts. The available commit-workflow-runs connector is limited to pull-request-triggered runs, while this project intentionally commits directly to `main`; therefore it returned no run object for the push.

This is an evidence-observation limitation, not a pass and not a code failure.

## Progress decision

P0-15 remains **implemented / local-pass / CI-evidence-pending**. Standalone verified count remains `0 / 162` and P0-18 remains blocked. Historical migration provenance remains `20 / 162`.

P0-20 is now partial in the standalone repository because the free-tier-conscious CI boundary exists, but its full lint/type/test/migration gate has not yet been revalidated.

## Next run

First inspect whether exact-main CI evidence for the optimized executable state has become observable. If a genuine failure is available, repair P0-15/scaffold only. If a pass is available, promote P0-15 and then begin P0-18. Do not rerun unchanged failures and do not trigger Actions for documentation-only commits.
