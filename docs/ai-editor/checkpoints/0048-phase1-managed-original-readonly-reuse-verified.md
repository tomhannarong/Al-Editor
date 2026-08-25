# Checkpoint 0048 — Phase 1 managed-original read-only reuse invariant verified

Date: 2026-08-25 (Asia/Bangkok)

Starting HEAD: `80856def17284483208a8ee0a43a74cba53f6aed`.

## Audit

This continuation re-read `PROJECT_BIBLE.md`, `docs/ai-editor/progress.json`, `docs/ai-editor/PROGRESS.md`, `docs/ai-editor/IMPLEMENTATION_MAPPING.md`, checkpoint 0047, exact current `main` HEAD and the available P1-11 runtime status before changing code.

P1-11 was complete and had exact real-runtime evidence. The next smallest independent Phase-1 correctness gap was in managed-original immutability enforcement: a content-addressed destination was made read-only when first created, but a later idempotent reuse only byte-verified the existing file. If an external actor changed its mode to writable after first publication without changing bytes, the existing implementation reused it without restoring the read-only application guard.

This does not change SHA-256 identity or byte verification semantics, but it weakens Bible invariant 1 (original media is immutable) at the managed-storage boundary.

## P1-12 — managed-original read-only invariant on verified reuse

Implementation commit `58432e1fd35569d230ea060f6b3b82ea08d96946` (`fix: restore managed originals read-only on reuse`) changes only the existing managed-original primitive and adds one focused deterministic filesystem test.

Changes:

- `packages/media-catalog/src/managed-original.ts`
  - keeps full size+SHA-256 verification of the final destination;
  - after successful verification, enforces `chmod(destinationPath, 0o444)` for every materialization, including existing/idempotently reused content;
  - performs the read-only enforcement before managed location state is rebound/returned;
  - preserves fail-closed behavior for corrupted or mismatched bytes.
- `packages/media-catalog/src/managed-original-readonly.test.ts`
  - creates and materializes a valid managed original;
  - deliberately changes its mode from `0444` to `0644` without modifying bytes;
  - re-ingests the same immutable asset;
  - proves `created === false` and the exact same SHA-256-derived content path is reused;
  - proves the final mode is restored to `0444`.

## Validation

Exactly one normal CI run was used as the final confidence gate because package implementation/test code changed.

Exact evidence:

- implementation SHA: `58432e1fd35569d230ea060f6b3b82ea08d96946`
- AI Editor CI run: `32824631728`
- validate job: `97729857134`
- dependency install: success
- strict TypeScript: success
- Vitest behavioral gate: success
- deterministic migration gate: success
- contract and policy gates: success
- observable commit status publication: success
- exact status: **`ai-editor-ci/all = success`**

No PostgreSQL/Qdrant local-stack workflow, matrix, FFmpeg real-media workflow or unchanged rerun was triggered.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time authority, renderer-neutral v2 adapter boundary, style profile, delivery profile, structured logging, provenance/rights, immutable revision/render evidence and FFmpeg `-copyts` behavior remain unchanged.

Stable media identity remains derived only from SHA-256 bytes. Storage locations remain mutable catalog state. Native integer PTS plus rational stream time base remain source timing authority. The mode hardening adds no alternate identity, timing or persistence path.

## Progress

```text
Standalone verified: 34 / 162 = 20.99%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:     12 / 14  = 85.71%
```

## Next task

Audit the two remaining Phase-1 items against the now-hardened durable ingest path. The leading candidate is determining whether the Phase-1 gate still needs a selective real `ffprobe` executable proof against a managed original, beyond the already verified shell-free bounded process behavior, deterministic native-timing normalization and real PostgreSQL durability. If such runtime media evidence is required, add the smallest selectively triggered verifier and avoid broad/heavy CI. Do not begin Phase 2 until Phase 1 is explicitly closed with evidence.
