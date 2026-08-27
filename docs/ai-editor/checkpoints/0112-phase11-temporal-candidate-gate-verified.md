# Checkpoint 0112 — Phase-11 temporal candidate gate verified

## Starting authority

- Bible revision: `1.2-standalone-ai-editor`.
- Starting main HEAD: `41e59da883c554cacacaf825bc3179d8407e9cf1`.
- Starting verified count: `96 / 162 = 59.26%`.
- Starting task: P11-04 — implement the smallest deterministic advanced temporal candidate and compare it on the exact frozen fixture with measured baseline/candidate cost.
- Phase-10 blocker remains external-only: real DaVinci Resolve import/relink/re-export proof.

## Local-first validation state

A local clone was attempted before implementation, but this execution environment still could not resolve `github.com`. No local pass was claimed and the DNS failure was not treated as a code failure. Static design review was performed before a single code push was used as the final confidence gate.

## P11-04 implementation

Initial implementation SHA `b70015ee6c2bf1ddefbd320c2328abff5fac0c2d` added:

- `packages/temporal-intelligence-library/src/temporal-adjacency-candidate.ts`;
- `packages/temporal-intelligence-library/src/temporal-adjacency-candidate.test.ts`.

The candidate:

- uses exact asset/stream lineage and native PTS;
- inserts the nearest valid non-overlapping temporal successor;
- suppresses overlap duplicates at IoU >= 0.5;
- caps rankings at 10;
- does not consume expected benchmark labels as candidate-ranking input;
- uses the existing P11-01 comparison contract;
- measures baseline and candidate inside the same runtime/process;
- reports the same normalized `ranked-scene-evaluation:v1` workload unit;
- preserves canonical timeline/media-time authority and introduces no new timing authority.

## Initial gate failure

AI Editor CI run `33106149235`, job `98636404081`, on `b70015ee6c2bf1ddefbd320c2328abff5fac0c2d`:

- dependency install: success;
- strict TypeScript: success;
- Vitest: failure;
- migrations and contract gates: skipped;
- exact status: `ai-editor-ci/unit-tests = failure`.

Three assertions were wrong: the test expected an unnecessary `scene:a3:r1` in `case:ordered-a` and therefore expected 12 candidate ranked-scene evaluations. The deterministic implementation correctly produced `[scene:a1:r1, scene:a2:r1]` for that case and 11 total ranked-scene evaluations. The failed SHA was not rerun unchanged.

Repair SHA `096863f2930b3ab6e5a96e7c2ab8f4e6daa124c3` changed only those test expectations.

## Successful validation

AI Editor CI run `33106247598`, job `98636758233`, on exact repair SHA `096863f2930b3ab6e5a96e7c2ab8f4e6daa124c3` passed:

- dependency install;
- strict TypeScript;
- `68` Vitest files / `372` tests;
- deterministic migrations;
- contract/policy gates;
- observable status publication;
- exact `ai-editor-ci/all = success`.

No heavyweight PostgreSQL/Qdrant/FFmpeg workflow, matrix, or unchanged rerun was used.

## Same-fixture quality win

Frozen lightweight -> candidate:

- temporal Recall@10: `0.8333333333333334 -> 1.0`;
- ordered sequence completion rate: `0.6666666666666666 -> 1.0`;
- duplicate occupancy: `0.1 -> 0.0`.

Every frozen Phase-11 quality metric improved.

## Same-process measured cost

Node `v22.23.2`, Linux x64, same test process; 50 warmups, 5 samples, 1000 evaluations/sample.

Baseline samples ms/evaluation:
`[0.056503342000000005, 0.023003296, 0.014320703, 0.012327988, 0.012318975]`

Candidate samples ms/evaluation:
`[0.083928219, 0.068965395, 0.048893583, 0.040907964, 0.040091123000000006]`

- baseline median: `0.014320703 ms/evaluation`;
- candidate median: `0.048893583 ms/evaluation`;
- observed wall-clock ratio: approximately `3.414x`;
- baseline compute: `10 ranked-scene-evaluation:v1 units/evaluation`;
- candidate compute: `11 ranked-scene-evaluation:v1 units/evaluation`.

No acceptable-cost threshold was invented. The measured cost is evidence for decision-making, not an SLO.

## Gate conclusion and progress

The Bible Phase-11 gate requires `benchmark win + measured cost vs lightweight baseline`. Both are now exact and verified on the frozen benchmark revision.

- Standalone verified: `97 / 162 = 59.88%`.
- Phase 10: exact real-Resolve runtime gate remains open.
- Phase 11: `verified-complete`.
- Active phase advances to Phase 12 — Content Agent.

## Next task

P12-01 — audit the existing API/orchestration surfaces and freeze the smallest versioned Content Agent boundary. The agent must orchestrate existing verified APIs/capabilities only and must not create a hidden parallel ingest, retrieval, planning, timeline, render, export, provenance, or review workflow.
