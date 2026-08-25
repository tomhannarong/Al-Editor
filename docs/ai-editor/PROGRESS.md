# AI Local Footage Editor — Progress

**Repository:** `tomhannarong/Al-Editor` / `main`  
**Phase:** 1 — Global Media Catalog + Immutable Ingest  
**Current task:** audit the remaining Phase-1 ingest surface for a shell-free bounded ffprobe execution boundary before adding any new metadata capability

```text
Standalone verified: 28 / 162 = 17.28%
Phase 0:             22 / 22  = 100.00% COMPLETE
Phase 1:              6 / 14  = 42.86% verified
```

Phase 0 verified: P0-01 through P0-22.

## Phase 1 verified slices

### P1-01 — stable media identity / mutable location boundary
Implementation commit `c68362f7166aba1a33137b89474caa93a8cf163f`; exact `ai-editor-ci/all = success`, run `32772298608`.

### P1-02 — streaming content-addressed ingest + deterministic persistence semantics
Implementation `2cba444a4890b81eb565ca22687fd8e7c2d43a86`, repaired by `b820fc809f99f438b8ff7b8681c6b983e26122ee`; exact `ai-editor-ci/all = success`, run `32776732634`.

### P1-03 — normalized ffprobe native stream metadata
Implementation `705e1dc8c1b348b5b2189f23a239969368434412`; exact `ai-editor-ci/all = success`, run `32782942297`. Native integer PTS + rational time base remain authority; decimal seconds are ignored.

### P1-04 — PostgreSQL durable media catalog
Implementation `d74ae15817958df9279dffa6fcf9313a2f456fee`, strict-TypeScript repair `7a93cb3fbf75a160d8b6de8456c4576c72bb3fdf`, runtime verifier `b31086c30d9c8a6e949e661363236226bfad015e`, workflow repair `303f01181aea935d0a87dd6472d48fcacbdce340`.

Static/behavioral gate: `ai-editor-ci/all = success`, run `32788230358`. Real PostgreSQL runtime gate: AI Editor Local Stack Gate run `32793644151`, job `97640306272` = success on `303f0118...`.

### P1-05 — confined local-file immutable ingest
Implementation commit `f9d704b3ce5474fe035d40f598e35ea9d871fd2b`; AI Editor CI run `32799561623`, job `97657612381` = success. Allowed-root confinement, direct symlink rejection, read-only/no-follow open, bounded hashing and stable file snapshots are verified before catalog publication.

### P1-06 — managed content-addressed immutable original materialization
Implementation commit `ab2ad1346c56012f6c464cbb0cf7f9f813d82f56` added `packages/media-catalog/src/managed-original.ts` and deterministic filesystem tests. Managed copies are stored at `managedRoot/sha256/<prefix>/<digest>`, use a temporary exclusive file plus atomic hard-link publish, are made read-only, and are fully byte-verified against the registered immutable asset before a managed storage location is published.

The first CI run `32803732504` failed only at strict TypeScript because one test fixture hardcoded an obsolete schema literal; Vitest/migration/contract gates were skipped and the run was not rerun unchanged. Repair commit `1e7dbc208dc66d6e9080c3c104b00ce2a9104aed` aligned the fixture with the existing `MEDIA_ASSET_IDENTITY_SCHEMA_VERSION = "1.0"` contract.

Exact repaired evidence: **AI Editor CI run `32803814061`, job `97669865113`, `ai-editor-ci/all = success`**. TypeScript passed, Vitest passed **87/87** including 5 managed-original tests, migration gates passed, and all contract/policy gates passed.

## Validation / free-tier discipline

Local cloning was attempted first but the execution environment still could not resolve `github.com`, so no local pass is claimed. The implementation was batched into one code commit; after a real TypeScript failure, only the causative test fixture was repaired and a fresh CI run was allowed. No unchanged failed run was rerun. No PostgreSQL/Qdrant local-stack, FFmpeg integration, matrix or heavyweight media workflow was triggered for this filesystem-only slice.

Canonical timeline v1/v2 compatibility, centralized media-time authority, renderer-neutral adapter boundary, style/delivery/provenance/model contracts, immutable revision/render evidence, PostgreSQL media-catalog semantics and FFmpeg `-copyts` behavior remain unchanged.

## Next task

Audit the remaining Phase-1 checklist for the smallest independent ingest gap. The leading candidate is a **shell-free, bounded ffprobe execution boundary** that invokes ffprobe without shell authority, caps runtime/output, validates JSON before normalization, and preserves native PTS/rational time-base authority. Do not add heavyweight real-media CI unless the Bible gate for that slice requires runtime proof.