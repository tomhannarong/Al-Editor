# Checkpoint 0043 — Phase 1 managed immutable original materialization verified

Date: 2026-08-25 (Asia/Bangkok)

Starting HEAD: `97e4267be03d3dc4ba83ef346a56c32a8c3f23f1`.

## Audit and selected slice

The run re-read `PROJECT_BIBLE.md`, `docs/ai-editor/progress.json`, `docs/ai-editor/PROGRESS.md`, `docs/ai-editor/IMPLEMENTATION_MAPPING.md`, checkpoint 0042 and exact current `main`/Actions evidence before modifying code.

The audit confirmed that Phase 1 already had verified stable byte-derived asset identity, mutable location rebinding, streaming SHA-256/idempotent registration, normalized native ffprobe metadata, PostgreSQL durability and confined local-file hashing. The remaining Bible invariant gap was original-media ownership: the system could verify a source file without yet materializing its own immutable managed copy.

## Implementation

Implementation commit `ab2ad1346c56012f6c464cbb0cf7f9f813d82f56` (`feat: materialize managed immutable originals`) added:

- `packages/media-catalog/src/managed-original.ts`
- `packages/media-catalog/src/managed-original.test.ts`

The new managed-original boundary:

- requires the exact immutable asset to already be registered;
- confines the source to an explicit allowed source root and rejects direct source symlinks;
- stores managed originals under `managedRoot/sha256/<first-two-digest-chars>/<full-digest>` so caller filenames never become identity;
- creates a temporary destination with exclusive create semantics;
- copies in bounded chunks while hashing and verifies source snapshot stability;
- refuses publication if source bytes no longer match the registered asset size/digest;
- publishes a new final path with hard-link create-if-absent semantics instead of overwriting an existing content path;
- verifies an existing destination before idempotent reuse;
- fully re-verifies the final managed bytes before publishing mutable catalog location state;
- fails closed on corrupted pre-existing destination content;
- marks successfully published managed content read-only (`0444`) as an additional application-level immutability guard.

## Validation and failure history

Local cloning was attempted first and again failed because the execution environment could not resolve `github.com`; no local pass is claimed.

The implementation was batched into one substantive code commit to minimize Actions use. Its first exact CI run was:

- AI Editor CI run `32803732504`
- job `97669638143`
- install: success
- strict TypeScript: failure
- Vitest/migration/contract stages: skipped
- observable status: `ai-editor-ci/typecheck = failure`

Exact compiler failure: `packages/media-catalog/src/managed-original.test.ts(141,9): TS2322` because one test fixture hardcoded schemaVersion `"media-asset-identity/v1"` while the already-canonical contract defines `MEDIA_ASSET_IDENTITY_SCHEMA_VERSION = "1.0"`.

The failed commit was not rerun unchanged. Repair commit `1e7dbc208dc66d6e9080c3c104b00ce2a9104aed` (`fix: align managed original test schema version`) changed only the incorrect fixture literal.

Exact repaired CI evidence:

- AI Editor CI run `32803814061`
- job `97669865113`
- install: success
- strict TypeScript: success
- Vitest: success, **14 test files / 87 tests passed**, including **5 managed-original tests**
- deterministic migration gate: success
- contract/policy gates: success
- published commit status: **`ai-editor-ci/all = success`** on exact repaired implementation HEAD

No PostgreSQL/Qdrant local-stack, FFmpeg integration, matrix or heavyweight media workflow was run because this slice is deterministic filesystem/catalog behavior and did not require those runtimes.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time authority, renderer-neutral adapter boundary, style/delivery/provenance/model contracts, immutable revision/render evidence, PostgreSQL media-catalog persistence and FFmpeg `-copyts` behavior remain unchanged.

Stable asset identity remains SHA-256 byte-derived; managed file paths and location URIs remain mutable location/persistence state rather than identity. Native integer PTS plus rational stream time base remain the source timing authority.

## Progress

```text
Standalone verified: 28 / 162 = 17.28%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:      6 / 14  = 42.86%
```

## Next task

Audit the remaining Phase-1 checklist for the smallest independent ingest gap. The leading candidate is a shell-free bounded ffprobe execution boundary: direct argv invocation only, bounded timeout/stdout/stderr, strict JSON parse handoff to the already verified native stream normalizer, and no decimal-seconds authority. Heavyweight real-media validation should remain manual/selective unless that slice's Bible gate specifically requires it.