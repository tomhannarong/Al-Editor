# AI Local Footage Editor — Progress

**Repository:** `tomhannarong/Al-Editor` / `main`  
**Phase:** 2 — Scene Library, Proxies, Keyframes  
**Current task:** immutable keyframe derivative revision persistence/idempotency after verified keyframe contract

```text
Standalone verified: 44 / 162 = 27.16%
Phase 0:             22 / 22  = 100.00% COMPLETE
Phase 1:             14 / 14  = 100.00% COMPLETE
Phase 2:              8 / 11  =  72.73% verified
```

Phase 0 remains verified-complete through P0-22. Phase 1 remains verified-complete through P1-14.

## Phase 2 verified slices

P2-01 through P2-07 remain verified with their existing exact evidence: versioned scene-set source mapping, immutable scene-set persistence/durability, rebuildable proxy contract/persistence/durability, and confined bounded real FFmpeg proxy generation.

### P2-08 — versioned rebuildable keyframe derivative contract
Implementation `59aa02eddf4357eb289ef244a820c99cd5de95ad`.

`packages/contracts/src/keyframe-derivative.contract.ts` defines rebuildable keyframe-image evidence for one immutable scene. Every revision binds to exact scene-set/revision/scene lineage plus immutable SHA-256 asset identity, stream identity/index and rational native time base. Each frame carries a safe-integer native `sourcePts`; frame IDs and source PTS values are unique, PTS values are strictly increasing, and artifact URIs are required only as derivative locations.

The contract explicitly keeps filename-encoded times, image paths and decoded/display timestamps out of canonical timing authority. Profile and toolchain versions are explicit so extraction can be rebuilt under a new immutable revision rather than mutating historical evidence.

Exact evidence on `59aa02eddf4357eb289ef244a820c99cd5de95ad`:

- AI Editor CI run `32881831056`, job `97912919380`: success
- TypeScript strict gate: success
- Vitest behavioral gate: success
- migration deterministic gate: success
- contract/policy gates: success
- `ai-editor-ci/all = success`

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time authority, renderer-neutral v2 adapter boundary, style/delivery/provenance/model contracts, structured logging, immutable revision/render evidence, Phase-1 media durability and Phase-2 scene/proxy durable lineage remain unchanged.

## Validation / free-tier discipline

A local clone was attempted before implementation but DNS resolution for `github.com` was unavailable, so no local pass is claimed. The contract slice used one normal single-job CI confidence gate and no local-stack/FFmpeg runtime workflow, matrix or rerun.

## Next task

Implement the smallest immutable keyframe derivative revision persistence/idempotency boundary. Exact semantic re-registration should be idempotent; conflicting `revisionId` reuse must fail closed. Keep PostgreSQL durability and real FFmpeg extraction as later selective slices.
