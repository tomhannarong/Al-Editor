# Checkpoint 0118 — Phase-13 backup/restore ownership and clean-target drill verified

## Starting authority

- Bible revision: `1.2-standalone-ai-editor`.
- Starting repository/head: `tomhannarong/Al-Editor` / `main` at `22ec03a9c0fdfe011f8f63ec079cb53634a659a9`.
- Starting active task: P13-03 — versioned backup/restore ownership + RPO/RTO contract and clean-target restore drill.
- Starting standalone verified count: `102 / 162 = 62.96%`.
- Phase-10 blocker remains external-only: real DaVinci Resolve import/relink/re-export proof.

## Scope and design

P13-03 closes the restore-drill portion of the Phase-13 production-hardening gate without changing canonical timeline/media-time/render/editorial contracts.

Substantive implementation commit `7f49b6da6e56bf955e6e6a5014bc6a98c3244d7b` adds:

- `packages/contracts/src/backup-restore-policy.contract.ts`;
- `packages/contracts/src/backup-restore-policy.contract.test.ts`;
- `infra/verify-backup-restore-runtime.sh`;
- `.github/workflows/restore-drill.yml`.

The pinned policy is `backup-restore:phase13:r1`, owned by `platform-operations`, with RPO `3600 s`, RTO `900 s`, PostgreSQL `pg-custom-dump`, Qdrant collection snapshots, SHA-256 integrity evidence, and mandatory clean-target restoration into identities distinct from the source.

Persistent Docker volumes remain runtime persistence only and are not treated as backup evidence.

## Static / contract confidence gate

AI Editor CI run `33131738073`, job `98722581787`, on substantive SHA `7f49b6da6e56bf955e6e6a5014bc6a98c3244d7b` completed successfully:

- dependency install: success;
- strict TypeScript: success;
- Vitest: `73` files / `394` tests passed;
- backup/restore policy tests: `4` passed;
- deterministic migration verification/self-test: success;
- existing style, delivery, registry, telemetry, logging, job-state and API-health gates: success;
- exact observable `ai-editor-ci/all = success`.

No additional CI run was spent for the later restore-script-only fixes because those changes did not modify TypeScript/contracts.

## Restore-drill failures and repairs

Failures are retained as evidence and no unchanged failed job was rerun.

1. Initial restore run `33131738022` failed in `actions/setup-node` because the workflow requested npm dependency caching but this repository has no npm lockfile. The restore runtime itself had not started. Repair commit `e524780661f5a8a2a7939018068e63fc7192120f` removed only the invalid cache assumption.
2. Restore run `33131770260` successfully booted real PostgreSQL/Qdrant but then failed with PostgreSQL `DROP DATABASE cannot run inside a transaction block`, because DROP and CREATE had been sent in one `psql -c` invocation. Repair commit `b3d909066c7101e1ddd6dfe946bb389efb292e44` separated the database operations and hardened cleanup.

Neither failed SHA was rerun unchanged.

## Final real restore evidence

AI Editor Restore Drill run `33131818477`, job `98722827127`, completed successfully on exact SHA `b3d909066c7101e1ddd6dfe946bb389efb292e44`.

The selective one-job gate used the already-pinned local stack and did not run the FFmpeg-heavy media integration workflow.

Measured evidence emitted by the drill:

```json
{
  "schemaVersion": "1.0",
  "policyId": "backup-restore:phase13",
  "policyRevisionId": "backup-restore:phase13:r1",
  "startedAt": "2026-08-28T01:06:38.000Z",
  "completedAt": "2026-08-28T01:06:40.000Z",
  "restoreDurationMs": 1606,
  "cleanTargetVerified": true,
  "stores": [
    {
      "store": "postgresql",
      "artifactSha256": "fbda74946d0524ab64834064c3564e6cb868e0728402077a124291ab3242307d",
      "sourceIdentity": "database:ai_editor_restore_source_v1",
      "targetIdentity": "database:ai_editor_restore_target_v1",
      "restoredRecordCount": 1
    },
    {
      "store": "qdrant",
      "artifactSha256": "a29711cec4c7dc3dbe63d8e79674d4e4544993f3d2e81dc4e24989d939050cea",
      "sourceIdentity": "collection:ai_editor_restore_source_v1",
      "targetIdentity": "collection:ai_editor_restore_target_v1",
      "restoredRecordCount": 1
    }
  ]
}
```

The PostgreSQL source database was populated, dumped, checksummed and deleted before restoration into a distinct target database. The Qdrant source collection was populated, snapshotted, checksummed and deleted before upload/recovery into a distinct target collection. Both targets were read back successfully. `1606 ms` is below the policy RTO of `900000 ms`.

Exact observable restore status is `ai-editor-restore/all = success`.

## Preserved authority

Canonical timeline v1/v2 compatibility, integer project-frame/rational-FPS rules, native source PTS/rational stream-time-base authority, renderer-neutral v2 adapter boundary, Style/Delivery profiles, provenance/rights evidence, immutable revision/render semantics, human-review evidence, retrieval/editorial separation and Content Agent orchestration boundaries are unchanged.

## Progress

- Standalone verified: `103 / 162 = 63.58%`.
- Phase 10: exact real-Resolve gate remains open.
- Phase 11: verified complete.
- Phase 12: verified complete.
- Phase 13: 3 verified slices; recovery and restore-drill evidence are now present; quota and cost/SLO evidence remain open.

## Next task

P13-04 — implement a versioned quota/admission policy and deterministic evaluator over bounded existing job/stage/resource evidence. Keep it separate from canonical correctness/timing authority and use static/unit evidence unless a real runtime gate becomes necessary.
