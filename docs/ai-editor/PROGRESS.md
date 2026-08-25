# AI Local Footage Editor — Progress

**Repository:** `tomhannarong/Al-Editor` / `main`  
**Phase:** 2 — Scene Library, Proxies, Keyframes  
**Current task:** audit durable PostgreSQL proxy derivative revision persistence/readback before real proxy generation

```text
Standalone verified: 41 / 162 = 25.31%
Phase 0:             22 / 22  = 100.00% COMPLETE
Phase 1:             14 / 14  = 100.00% COMPLETE
Phase 2:              5 / 11  =  45.45% verified
```

Phase 0 remains verified: P0-01 through P0-22. Phase 1 remains verified-complete: P1-01 through P1-14.

## Phase 2 verified slices

### P2-01 — versioned scene-set identity and exact source-mapping contract
Implementation `8759bc0437d672f4e63329fcc19b84172b9e433d`; CI `32840639465` / job `97779125483` success.

### P2-02 — immutable scene-set revision persistence and idempotency
Implementation `c877b5e91f190ba490a1b6767759b4ff69268e02`, repair `e221be705e2dbd69e14df5dbbca7b5b949f17c29`; CI `32845521695` / job `97794189378` success.

### P2-03 — PostgreSQL durable scene-set revision persistence/readback
Implementation `5c91fa9a4acf2ea23b198d3027142109d04cd630`, runtime repair `7cf7b857bfef8585897f208f21cbbe50d723a34c`; CI `32852840324` and real PostgreSQL gate `32853149558` success.

### P2-04 — versioned rebuildable proxy derivative contract
Implementation `236dba5785f33eb861094f08459840cbec223a93`; CI `32857635477` / job `97833415918` success. Proxy metadata carries scene-set lineage, stable asset/stream mapping, rational source time base, explicit profile/toolchain versions and rebuildable artifact location without creating decimal-time authority.

### P2-05 — immutable proxy derivative revision persistence/idempotency
Implementation `f950775fadea9b3681c4c7fdec93cb27b59f29f8` adds `packages/proxy-library/src/index.ts` and deterministic tests. `revisionId` is immutable evidence identity: semantically equivalent re-registration, including equivalent rational time bases, is idempotent; conflicting source/profile/toolchain/artifact/creation evidence fails closed before mutation; stored results are defensive copies.

A rebuilt artifact at a changed URI must use a new revision rather than mutating old evidence. Artifact location is still rebuildable derivative state and remains downstream of the unchanged canonical source mapping.

Exact final-gate evidence: **AI Editor CI run `32863422284`, job `97852730546`, `ai-editor-ci/all = success` on `f950775f...`**. Install, strict TypeScript, Vitest, deterministic migrations, contract/policy gates and observable status all passed.

No PostgreSQL/Qdrant local-stack, FFmpeg proxy generation, matrix or heavyweight media workflow was used for this metadata-only slice.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time authority, renderer-neutral v2 adapter boundary, style/delivery/provenance/model contracts, structured logging, immutable revision/render evidence, Phase-1 media durability, scene-set source mapping/persistence and FFmpeg `-copyts` behavior remain unchanged.

Proxy derivatives remain rebuildable/versioned. No derivative URI, presentation duration, milliseconds or codec-derived decimal time can replace native PTS + rational source time base.

## Validation / free-tier discipline

The execution environment has no usable local repository clone, so no local test pass is claimed. The implementation and deterministic tests were batched into one substantive commit and one normal CI run was used as the final confidence gate. No runtime gate was justified because this slice changes no database or media-process behavior.

## Next task

Audit the smallest **durable PostgreSQL proxy derivative revision persistence/readback boundary**. Reuse P2-05 immutable conflict/idempotency semantics, preserve scene-set/source lineage, and keep artifact metadata rebuildable. Do not start real FFmpeg proxy generation until durable derivative evidence is independently explicit and verified.
