# AI Local Footage Editor — Progress

**Repository:** `tomhannarong/Al-Editor` / `main`  
**Active implementation phase:** 13 — Production Scale / Hardening  
**Blocked external gate:** Phase 10 exact DaVinci Resolve runtime proof  
**Current task:** P13-03 — versioned backup/restore ownership + RPO/RTO contract and clean-target restore drill

```text
Standalone verified: 102 / 162 = 62.96%
Phase 0:             22 / 22  = 100.00% COMPLETE
Phase 1:             14 / 14  = 100.00% COMPLETE
Phase 2:             11 / 11  = 100.00% COMPLETE + GATE VERIFIED
Phase 3:              9 / 9   = 100.00% COMPLETE + GATE VERIFIED
Phase 4:              6 / 6   = 100.00% COMPLETE + GATE VERIFIED
Phase 5:              7 / 7   = 100.00% COMPLETE + GATE VERIFIED
Phase 6:              4 / 4   = 100.00% COMPLETE + GATE VERIFIED
Phase 7:              6 / 6   = 100.00% COMPLETE + GATE VERIFIED
Phase 8:              6 verified slices; GATE VERIFIED
Phase 9:              5 verified slices; GATE VERIFIED
Phase 10:             3 verified slices; GATE OPEN on real Resolve runtime proof
Phase 11:             4 verified slices; GATE VERIFIED
Phase 12:             3 verified slices; GATE VERIFIED
Phase 13:             2 verified slices; GATE OPEN
```

## Phase 10 blocker remains exact and narrow

P10-05 still requires a real DaVinci Resolve import + project-relative relink + OTIO re-export capture. Static evidence is not substituted for the exact target-NLE runtime gate.

## P13-02 verified — fenced expired-lease recovery

Durable job state machine v1 now has an additive `recover-expired` command. The persisted job shape and `stateMachineVersion = 1.0` remain unchanged.

Recovery semantics are intentionally fail-closed:

- only `leased` or `running` jobs with persisted lease evidence may be recovered;
- recovery is rejected before `expiresAt`;
- recovery clears lease ownership/token atomically;
- if attempts remain, the job returns to `queued` without incrementing `attempt` during recovery;
- if the expired lease consumed `maxAttempts`, recovery transitions directly to terminal `failed`;
- stale worker tokens cannot mutate the recovered queued job;
- a fresh lease uses a new token and increments the next attempt normally.

Implementation commit: `92193b0fb8f3d553721efd95bb13d00765f50d59`.

A dedicated deterministic recovery drill was added in `packages/contracts/src/job-state-machine.recovery-drill.test.ts` at `22ba7627a4c6748bf9957f56cdfa5246fd709984`. The drill proves: abandoned running work expires -> recovery returns it to queued -> old token is fenced -> a new worker leases/restarts -> the job succeeds under the fresh token.

Local-first validation was attempted before relying on Actions, but this execution environment could not resolve `github.com`. No local pass was claimed and the DNS failure was not treated as a code failure.

The first code commit's workflow run `33127808551` was cancelled by the repository concurrency policy after the focused recovery-drill commit superseded it. It was not rerun. Final confidence evidence is AI Editor CI run `33127847165`, job `98710140160`, against exact SHA `22ba7627a4c6748bf9957f56cdfa5246fd709984`:

- dependency install: success;
- strict TypeScript: success;
- Vitest: `72` files / `390` tests passed;
- `job-state-machine.contract.test.ts`: `12` tests passed;
- `job-state-machine.recovery-drill.test.ts`: `1` end-to-end deterministic recovery drill passed;
- deterministic migration verification/self-test: success;
- Style/Delivery/registry/telemetry/logging/job/API-health policy gates: success;
- exact observable `ai-editor-ci/all = success`.

No PostgreSQL/Qdrant/FFmpeg heavyweight workflow was required for this pure durable-state transition slice.

## Preserved contracts

Canonical timeline v1/v2 compatibility, integer project-frame/rational-FPS authority, native source PTS/rational time-base authority, renderer-neutral v2 adapters, immutable revision/render evidence, Style/Delivery/provenance contracts, human-review semantics, retrieval/editorial separation and Content Agent orchestration boundaries remain unchanged.

## Next task

P13-03 — define a versioned backup/restore contract with explicit owner, durable-store scope, RPO/RTO, integrity/checksum evidence and clean-target restore requirements. Then add the smallest selective real restore drill needed to prove application-readable recovery without converting persistent volumes into a false backup claim.
