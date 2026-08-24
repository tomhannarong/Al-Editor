# AI Local Footage Editor — Progress

**Repository:** `tomhannarong/Al-Editor` / `main`  
**Phase:** 1 — Global Media Catalog + Immutable Ingest  
**Current task:** persist normalized native stream metadata from ffprobe behind the verified media-catalog boundary without introducing derived-seconds authority

```text
Standalone verified: 24 / 162 = 14.81%
Phase 0:             22 / 22  = 100.00% COMPLETE
Phase 1:              2 / 14  = 14.29% verified
```

Phase 0 verified: P0-01 through P0-22.

## Phase 1 verified slices

### P1-01 — stable media identity / mutable location boundary

Implementation commit `c68362f7166aba1a33137b89474caa93a8cf163f` introduced `packages/contracts/src/media-catalog.contract.ts` and tests. Exact repository CI evidence is now observable: `ai-editor-ci/all = success`, run `32772298608`.

Verified invariants:

- `assetId` is canonicalized from SHA-256 bytes as `sha256:<64-hex>`;
- mutable storage URI/location is separate state keyed to the stable asset;
- identical immutable bytes remain the same logical asset after move/rename/re-ingest;
- normalized stream metadata retains native PTS plus rational time base and omits decimal-second authority.

### P1-02 — streaming content-addressed ingest + deterministic persistence semantics

Code landed as `2cba444a4890b81eb565ca22687fd8e7c2d43a86` and the required TypeScript environment repair as `b820fc809f99f438b8ff7b8681c6b983e26122ee`.

`packages/media-catalog/src/index.ts` now provides:

- incremental SHA-256 over `Iterable`/`AsyncIterable<Uint8Array>` without whole-file buffering;
- idempotent immutable asset registration;
- mutable location rebinding independent of asset identity;
- preservation of first-ingest evidence on byte-identical re-ingest;
- defensive-copy persistence semantics so callers cannot mutate stored identity.

Vitest coverage proves chunk-boundary independence, async streaming equivalence, byte-identical idempotency, rename/re-location behavior, changed-byte location rebinding and persisted-identity immutability.

The first code commit triggered run `32776611559`, which failed specifically at the strict TypeScript gate before Vitest. It was not rerun unchanged. The repair commit added the missing Node type dependency required by the new `node:crypto` import, creating a legitimate code/config reason for a new gate. Exact final evidence for `b820fc8...` is `ai-editor-ci/all = success`, run `32776732634`.

## Validation / free-tier discipline

The execution container still cannot resolve `github.com`, so no local runtime pass is claimed. GitHub Actions was used only as the final confidence gate for code-bearing commits. The failed commit was not rerun; the follow-up run was caused by a concrete dependency repair. No manual PostgreSQL/Qdrant or FFmpeg/media integration workflow was triggered. Documentation/checkpoint closure is path-filtered out of normal CI.

Canonical timeline v1/v2 compatibility, media-time rounding authority, renderer-neutral adapter boundary, style/delivery/provenance/model contracts, immutable revision/render evidence and FFmpeg `-copyts` semantics remain unchanged.

## Next task

Implement the next smallest Phase-1 dependency: normalized ffprobe stream-metadata ingestion into the media catalog, preserving integer native `startPts`/`durationPts` and rational `timeBase`. Parsing must fail closed for malformed or unsafe timing and must not promote seconds/milliseconds to canonical authority. Prefer deterministic parser fixtures first; real-media FFprobe validation can remain selective/manual until the Phase-1 runtime gate requires it.
