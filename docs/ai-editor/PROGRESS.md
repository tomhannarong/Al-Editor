# AI Local Footage Editor — Progress

**Repository:** `tomhannarong/Al-Editor` / `main`  
**Phase:** 2 — Scene Library, Proxies, Keyframes  
**Current task:** confined shell-free bounded real FFmpeg keyframe extraction

```text
Standalone verified: 46 / 162 = 28.40%
Phase 0:             22 / 22  = 100.00% COMPLETE
Phase 1:             14 / 14  = 100.00% COMPLETE
Phase 2:             10 / 11  =  90.91% verified
```

Phase 0 remains verified-complete through P0-22. Phase 1 remains verified-complete through P1-14.

## Phase 2 verified slices

P2-01 through P2-09 remain verified with their existing exact evidence: versioned scene-set source mapping, immutable scene-set persistence/durability, rebuildable proxy contract/persistence/durability, confined bounded real FFmpeg proxy generation, versioned keyframe derivative evidence and immutable in-memory keyframe revision semantics.

### P2-10 — PostgreSQL durable keyframe derivative revision persistence/readback

Implementation `bc8431dffaf8a5c2d682b779557b46f004508e92`.

Migration `0005_create_keyframe_library.sql` adds durable immutable keyframe revision evidence plus ordered frame rows. The revision row references the exact persisted scene-set source tuple and the exact `(scene_set_revision_id, scene_id)` interval. Frame rows persist only `frameId`, native safe-integer `sourcePts`, ordered ordinal and rebuildable `artifactUri`; no seconds/milliseconds timing authority was introduced.

`PostgresKeyframeDerivativeRevisionStore` normalizes rational source time bases before insert, inserts revision + frames in one transaction, treats exact semantic re-registration as idempotent, and rejects conflicting `revisionId` reuse without replacing historical evidence. Readback validates and defensively copies the reconstructed revision.

Exact evidence on `bc8431dffaf8a5c2d682b779557b46f004508e92`:

- AI Editor CI run `32892664602`, job `97947954572`: success
- TypeScript strict gate: success
- Vitest behavioral gate: success
- migration deterministic gate: success
- contract/policy gates: success
- `ai-editor-ci/all = success`
- AI Editor Local Stack Gate run `32892664650`, job `97947954495`: success
- PostgreSQL + Qdrant runtime: success
- media catalog / durable ingest / scene / proxy / keyframe PostgreSQL verifier chain: success
- real FFmpeg proxy generation regression gate: success
- API health against real dependencies: success
- `ai-editor-local-stack/all = success`

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time authority, renderer-neutral v2 adapter boundary, style/delivery/provenance/model contracts, structured logging, immutable revision/render evidence, Phase-1 media durability and Phase-2 exact scene/proxy/keyframe source lineage remain unchanged. Native PTS + rational stream time base remain source-time authority.

## Validation / free-tier discipline

This database slice used one normal single-job CI gate and one selective local-stack runtime gate because real PostgreSQL foreign-key/transaction/readback proof was required. No matrix or unchanged rerun was used. The next docs-only closure is path-filtered and must not trigger Actions.

## Next task

Implement the final Phase-2 slice: confined, shell-free, bounded real FFmpeg keyframe extraction from managed immutable originals, preserving exact scene/source native-PTS lineage and treating extracted image bytes/URIs as rebuildable derivative state only. After that, reconcile the Phase-2 gate before advancing to Phase 3.
