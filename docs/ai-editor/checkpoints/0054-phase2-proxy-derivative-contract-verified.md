# Checkpoint 0054 — Phase 2 proxy derivative contract verified

Date: 2026-08-25 (Asia/Bangkok)

Starting HEAD: `cfce8fff8671ea11c96defbd90c77ada2ed388a9`.

## Required startup audit

This run re-read `PROJECT_BIBLE.md`, `docs/ai-editor/progress.json`, `docs/ai-editor/PROGRESS.md`, `docs/ai-editor/IMPLEMENTATION_MAPPING.md`, checkpoint 0053, exact `main` HEAD and available CI evidence before modifying code.

The starting HEAD was documentation-only and had no commit status. P2-03 remained verified with normal CI run `32852840324` and repaired selective PostgreSQL runtime run `32853149558`. Repository search found no existing proxy/keyframe derivative contract, so the smallest dependency-correct Phase-2 gap was an explicit rebuildable/versioned proxy derivative boundary before persistence or FFmpeg generation.

No local clone/test pass is claimed in this execution environment. The change was kept deterministic and contract-only so one normal CI run could act as the final confidence gate.

## Selected slice

P2-04 — **versioned rebuildable proxy derivative contract**.

Implementation commit:

`236dba5785f33eb861094f08459840cbec223a93` — `feat: define rebuildable proxy derivative contract`

Added:

- `packages/contracts/src/proxy-derivative.contract.ts`
- `packages/contracts/src/proxy-derivative.contract.test.ts`

## Contract semantics

`ProxyDerivativeRevision` requires:

- explicit schema, derivative and revision identity;
- immutable `sceneSetId` + `sceneSetRevisionId` lineage;
- canonical SHA-256 source asset identity;
- source stream identity/index;
- rational source time base normalized through the existing canonical rational authority;
- explicit derivative-profile version;
- pinned toolchain name/version;
- rebuildable artifact URI;
- creation evidence.

The contract intentionally does not add proxy duration, decimal seconds or milliseconds as source authority. Artifact URI/profile/toolchain properties remain downstream derivative state. `sameProxyDerivativeSource(...)` compares only immutable scene-set/source lineage plus normalized rational source time base, so changing where/how a proxy is generated cannot redefine the source.

Deterministic tests cover valid derivative evidence, required profile/toolchain versioning, malformed/mutable source identity rejection, invalid stream/rational mapping, equivalent rational normalization and independence of artifact location from source identity.

## Validation

Exactly one normal final-gate run was used:

- AI Editor CI run `32857635477`
- job `97833415918`
- exact implementation SHA `236dba5785f33eb861094f08459840cbec223a93`
- install: success
- strict TypeScript: success
- Vitest behavioral gate: success
- deterministic migration gate: success
- contract/policy gates: success
- observable status publication: success
- exact status: **`ai-editor-ci/all = success`**

No PostgreSQL/Qdrant local-stack, FFmpeg proxy generation, matrix, rerun or heavyweight media workflow was triggered because this slice changes only deterministic contract semantics.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time rules, renderer-neutral v2 adapter boundary, style/delivery/provenance/model contracts, structured logging, immutable revision/render evidence, Phase-1 media durability, P2 scene-set source mapping/persistence and FFmpeg `-copyts` behavior remain unchanged.

Derived artifacts remain explicitly rebuildable/versioned. Proxy URI or presentation metadata cannot become canonical source timing authority.

## Progress

```text
Standalone verified: 40 / 162 = 24.69%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:     14 / 14  = 100.00%
Phase 2 verified:      4 / 11  =  36.36%
```

## Next task

Audit the smallest proxy derivative persistence/idempotency boundary. Prefer additive metadata persistence that accepts exact semantic revision re-registration idempotently, rejects conflicting `revisionId` reuse before mutation and keeps artifact location rebuildable. Do not start real FFmpeg proxy generation until derivative revision semantics are explicit and independently verified.
