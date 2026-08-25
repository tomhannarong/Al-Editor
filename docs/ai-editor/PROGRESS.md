# AI Local Footage Editor — Progress

**Repository:** `tomhannarong/Al-Editor` / `main`  
**Phase:** 2 — Scene Library, Proxies, Keyframes  
**Current task:** audit the smallest proxy derivative persistence/idempotency boundary before real proxy generation

```text
Standalone verified: 40 / 162 = 24.69%
Phase 0:             22 / 22  = 100.00% COMPLETE
Phase 1:             14 / 14  = 100.00% COMPLETE
Phase 2:              4 / 11  =  36.36% verified
```

Phase 0 remains verified: P0-01 through P0-22. Phase 1 remains verified-complete: P1-01 through P1-14.

## Phase 2 verified slices

### P2-01 — versioned scene-set identity and exact source-mapping contract

Implementation `8759bc0437d672f4e63329fcc19b84172b9e433d`; AI Editor CI run `32840639465`, job `97779125483`, success. Scene sets bind immutable SHA-256 asset/stream identity to safe-integer native PTS + rational time base; derivative paths and decimal time remain non-authoritative.

### P2-02 — immutable scene-set revision persistence and idempotency

Implementation `c877b5e91f190ba490a1b6767759b4ff69268e02`, repaired by `e221be705e2dbd69e14df5dbbca7b5b949f17c29`; AI Editor CI run `32845521695`, job `97794189378`, success. Semantic re-registration is idempotent; conflicting `revisionId` reuse fails closed; new revisions are additive and stored evidence is defensively copied.

### P2-03 — PostgreSQL durable scene-set revision persistence/readback

Implementation `5c91fa9a4acf2ea23b198d3027142109d04cd630`, runtime repair `7cf7b857bfef8585897f208f21cbbe50d723a34c`. Normal CI run `32852840324`, job `97817616436`, success. Selective real PostgreSQL gate run `32853149558`, job `97818643421`, success. Durable mapping references the existing immutable media stream tuple and stores only native PTS + rational time-base source authority.

### P2-04 — versioned rebuildable proxy derivative contract

Implementation commit `236dba5785f33eb861094f08459840cbec223a93` adds:

- `packages/contracts/src/proxy-derivative.contract.ts`
- `packages/contracts/src/proxy-derivative.contract.test.ts`

A proxy derivative revision now requires immutable scene-set lineage (`sceneSetId` + `sceneSetRevisionId`), stable SHA-256 asset/stream identity, stream index, normalized rational source time base, explicit derivative-profile version, pinned toolchain name/version, artifact URI and revision evidence.

The contract deliberately excludes proxy duration/seconds/milliseconds from canonical source authority. `artifactUri`, derivative profile and toolchain metadata are downstream derivative state and do not participate in `sameProxyDerivativeSource(...)` source identity.

Exact final-gate evidence: **AI Editor CI run `32857635477`, job `97833415918`, `ai-editor-ci/all = success` on `236dba5785...`**. Install, strict TypeScript, Vitest, deterministic migrations, contract/policy gates and observable status all passed.

No PostgreSQL/Qdrant local-stack, FFmpeg proxy generation, matrix or heavyweight media workflow was used for this contract-only slice.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time authority, renderer-neutral v2 adapter boundary, style/delivery/provenance/model contracts, structured logging, immutable revision/render evidence, Phase-1 media durability, immutable scene-set evidence and FFmpeg `-copyts` behavior remain unchanged.

Proxy derivatives are explicitly rebuildable/disposable and remain downstream of scene-set source authority. No derivative URI, presentation duration or codec-derived decimal time can replace native PTS + rational source time base.

## Validation / free-tier discipline

The execution environment still has no usable local GitHub clone path, so no local test pass is claimed. The contract and tests were batched into one substantive implementation commit and exactly one normal CI run was used as the final confidence gate. No selective runtime gate was justified because this slice changes no database or media-process runtime behavior.

## Next task

Audit the smallest **proxy derivative persistence/idempotency boundary**. Prefer an additive in-memory or durable metadata store that treats exact revision re-registration as idempotent, conflicting revision reuse as fail-closed, and artifact location as rebuildable state. Do not start real FFmpeg proxy generation until derivative revision semantics are explicit and independently testable.
