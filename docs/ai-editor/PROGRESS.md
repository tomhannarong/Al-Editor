# AI Local Footage Editor — Progress

**Repository:** `tomhannarong/Al-Editor` / `main`  
**Phase:** 2 — Scene Library, Proxies, Keyframes  
**Current task:** PostgreSQL durable keyframe derivative revision persistence/readback

```text
Standalone verified: 45 / 162 = 27.78%
Phase 0:             22 / 22  = 100.00% COMPLETE
Phase 1:             14 / 14  = 100.00% COMPLETE
Phase 2:              9 / 11  =  81.82% verified
```

Phase 0 remains verified-complete through P0-22. Phase 1 remains verified-complete through P1-14.

## Phase 2 verified slices

P2-01 through P2-08 remain verified with their existing exact evidence: versioned scene-set source mapping, immutable scene-set persistence/durability, rebuildable proxy contract/persistence/durability, confined bounded real FFmpeg proxy generation, and the versioned rebuildable keyframe derivative contract.

### P2-09 — immutable keyframe derivative revision persistence/idempotency
Implementation `5ce040aeb14953f126cfe9dee8b22e086dd06775`.

`packages/keyframe-library/src/index.ts` adds the in-memory immutable metadata boundary for rebuildable keyframe revisions. `revisionId` is immutable evidence identity. Exact semantic re-registration is idempotent, including equivalent rational time bases after normalization. Reusing the same `revisionId` with changed source lineage, frame selection, frame artifact URI, profile/toolchain version or creation evidence fails closed before mutation.

Read and registration results deep-copy source, toolchain and every frame, so callers cannot mutate stored historical evidence. Re-extraction or a rebuilt artifact set must create a new immutable revision rather than replacing a prior revision.

Exact evidence on `5ce040aeb14953f126cfe9dee8b22e086dd06775`:

- AI Editor CI run `32886479355`, job `97928027272`: success
- TypeScript strict gate: success
- Vitest behavioral gate: success
- migration deterministic gate: success
- contract/policy gates: success
- `ai-editor-ci/all = success`

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time authority, renderer-neutral v2 adapter boundary, style/delivery/provenance/model contracts, structured logging, immutable revision/render evidence, Phase-1 media durability, Phase-2 scene/proxy durable lineage and native PTS+rational source-time authority remain unchanged.

## Validation / free-tier discipline

This slice used one normal single-job CI confidence gate. No PostgreSQL/Qdrant local-stack, FFmpeg keyframe extraction, matrix or rerun was used because P2-09 is an in-memory persistence/idempotency boundary and the normal repository gate was sufficient.

## Next task

Implement PostgreSQL durable keyframe derivative revision persistence/readback, reusing the P2-09 immutable conflict/idempotency semantics. Real FFmpeg keyframe extraction remains a later selective slice after durable evidence is proven.
