# Checkpoint 0042 — Phase 1 confined local-file ingest verified

Date: 2026-08-25 (Asia/Bangkok)

Starting HEAD: `2635e38810a39f0263fce51781a691748581952e`.

## Audit and selected slice

The required startup audit re-read `PROJECT_BIBLE.md`, `docs/ai-editor/progress.json`, `docs/ai-editor/PROGRESS.md`, `docs/ai-editor/IMPLEMENTATION_MAPPING.md`, checkpoint 0041 and exact `main` HEAD/CI evidence. Existing verified Phase-1 work already covered stable byte-derived identity, mutable location rebinding, streaming SHA-256/idempotent registration, normalized native ffprobe timing, and durable PostgreSQL persistence.

The smallest uncovered independent ingest boundary was local-file confinement and stability. The Bible requires immutable originals plus path/realpath confinement and symlink/path-traversal protection, while the existing streaming API accepted caller-provided chunks and URIs and therefore did not itself prove those filesystem properties.

## Implementation

Commit `f9d704b3ce5474fe035d40f598e35ea9d871fd2b` (`feat: confine local media file ingest`) added:

- `packages/media-catalog/src/local-file-ingest.ts`
- `packages/media-catalog/src/local-file-ingest.test.ts`

The new boundary:

- resolves an explicit allowed root and rejects resolved files outside it;
- rejects a direct symbolic-link media path;
- opens the resolved original read-only and uses `O_NOFOLLOW` where supported;
- hashes through bounded chunks using the existing SHA-256 content identity implementation;
- snapshots device, inode, byte size, mtime and ctime before/after hashing;
- refuses to publish asset/location state when the snapshot changes during the hashing window;
- derives the stored file URI from the resolved path rather than accepting an arbitrary URI;
- retains idempotent content identity and first-ingest evidence on repeat ingest.

## Validation and free-tier discipline

Local cloning was attempted before push, but the execution environment still failed DNS resolution for `github.com`; no local pass is claimed.

Exactly one normal CI run was used as the final confidence gate. No heavyweight local-stack, PostgreSQL/Qdrant or FFmpeg workflow was triggered because the new behavior is deterministic Node filesystem + contract logic and does not require those runtimes.

Exact evidence: AI Editor CI run `32799561623`, job `97657612381`, completed successfully on exact implementation commit `f9d704b3ce5474fe035d40f598e35ea9d871fd2b`.

Successful stages:

- dependency install;
- strict TypeScript;
- Vitest behavioral tests, including the new real temporary-filesystem fixtures;
- deterministic migration gate;
- contract and policy gates;
- observable commit-status publication.

Combined status: `ai-editor-ci/all = success` targeting run `32799561623`.

No failed job was rerun and no redundant heavyweight Actions gate was used.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time authority, renderer-neutral adapter boundary, style/delivery/provenance/model contracts, immutable revision/render evidence, PostgreSQL media-catalog semantics and FFmpeg `-copyts` behavior are unchanged. Native integer PTS plus rational stream time base remain the source timing authority; file path/URI remains mutable location state, not asset identity.

## Progress

```text
Standalone verified: 27 / 162 = 16.67%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:      5 / 14  = 35.71%
```

## Next task

Audit the remaining Phase-1 checklist for immutable-original materialization / managed storage semantics. If a managed original copy is required, implement the smallest content-addressed copy/commit boundary that verifies destination bytes before publishing location state. Otherwise select the next independent Phase-1 item without duplicating the five verified media-catalog capabilities.
