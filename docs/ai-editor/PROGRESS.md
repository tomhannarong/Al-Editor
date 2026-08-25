# AI Local Footage Editor — Progress

**Repository:** `tomhannarong/Al-Editor` / `main`  
**Phase:** 2 — Scene Library, Proxies, Keyframes  
**Current task:** audit the smallest real FFmpeg proxy-generation slice against the verified durable proxy revision boundary

```text
Standalone verified: 42 / 162 = 25.93%
Phase 0:             22 / 22  = 100.00% COMPLETE
Phase 1:             14 / 14  = 100.00% COMPLETE
Phase 2:              6 / 11  =  54.55% verified
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
Implementation `f950775fadea9b3681c4c7fdec93cb27b59f29f8`; CI `32863422284` / job `97852730546` success. Semantic re-registration is idempotent, conflicting immutable evidence fails closed, stored evidence is defensive, and changed derivative state requires an additive revision.

### P2-06 — PostgreSQL durable proxy derivative revision persistence/readback
Implementation `577a14456b5b7c48860f52f88dd0ac6a11d2f380` adds migration `0004_create_proxy_library.sql`, `PostgresProxyDerivativeRevisionStore`, deterministic tests and a selective PostgreSQL runtime verifier.

The durable row is constrained to the exact scene-set revision + immutable asset/stream + normalized rational source time base tuple. `artifactUri`, derivative profile and toolchain remain derivative evidence; none can replace native source timing authority. Same immutable revision registration is idempotent, while conflicting `revisionId` reuse fails closed inside a transaction.

Exact evidence on the implementation SHA:

- AI Editor CI run `32869312338`, job `97872229894`: success
- AI Editor Local Stack Gate run `32869312804`, job `97872230411`: success
- commit statuses: `ai-editor-ci/all = success` and `ai-editor-local-stack/all = success`
- real PostgreSQL verifier confirmed migration 0004, durable scene/source lineage, rational normalization, idempotent readback and immutable conflict rejection

No rerun was used. The implementation, tests, migration and runtime verifier were batched into one substantive commit. A local clone/test attempt was not claimed because the execution environment could not resolve `github.com`; repository validation therefore relied on the exact GitHub CI/runtime gates appropriate to this database slice.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time authority, renderer-neutral v2 adapter boundary, style/delivery/provenance/model contracts, structured logging, immutable revision/render evidence, Phase-1 media durability, scene-set persistence and FFmpeg `-copyts` behavior remain unchanged.

Proxy derivatives remain rebuildable/versioned and downstream of immutable scene-set/source authority. No derivative URI, presentation duration, milliseconds or codec-derived decimal time can replace native PTS + rational source time base.

## Validation / free-tier discipline

Only the two gates justified by this slice ran: one normal CI job for TypeScript/tests/migrations/contracts and one selective local-stack job for real PostgreSQL durability. No matrix, unchanged rerun or standalone heavyweight proxy generation was added.

## Next task

Audit the smallest **real FFmpeg proxy-generation slice** using the verified immutable/durable proxy revision boundary. Generation must be shell-free/bounded, source from the managed immutable original, preserve explicit scene/source lineage and emit only rebuildable derivative artifacts. Keep the media runtime selective/manual until a Phase-2 gate requires proof; do not let proxy timestamps or codec presentation fields become canonical timing authority.
