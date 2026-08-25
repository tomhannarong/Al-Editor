# Checkpoint 0050 — Phase 1 gate reconciled and closed

Date: 2026-08-25 (Asia/Bangkok)

Starting HEAD: `0706757e5c801db158e6cd33b4adef398877e82d`.

## Required startup audit

This run re-read `PROJECT_BIBLE.md`, `docs/ai-editor/progress.json`, `docs/ai-editor/PROGRESS.md`, `docs/ai-editor/IMPLEMENTATION_MAPPING.md`, checkpoint 0049, exact `main` HEAD and available CI/runtime evidence before making changes.

The local execution container still cannot resolve `github.com`; `git ls-remote` failed with `Could not resolve host: github.com`. No local clone/test pass is claimed. Because this run is a phase-gate evidence reconciliation rather than new code, existing exact CI/runtime evidence is the appropriate proof and no redundant Actions run is required.

## Phase-1 gate reconciliation

`PROJECT_BIBLE.md` defines the Phase-1 required proof as:

- idempotent content-addressed assets;
- normalized stream metadata;
- native timing.

The Bible invariants additionally require immutable originals, stable identity separate from storage location, and native PTS + rational stream time base rather than decimal seconds as source timing authority.

The accumulated standalone evidence covers each requirement directly:

### Idempotent content-addressed asset identity

P1-01/P1-02 prove SHA-256 byte-derived identity, URI-independent identity and idempotent re-ingest. P1-11/P1-13 extend that proof through real filesystem/PostgreSQL and real-media runtime composition.

### Immutable originals

P1-05 confines source paths and hashes stable read-only/no-follow file handles before catalog publication. P1-06 creates verified SHA-256-derived managed originals. P1-12 restores mode `0444` on every successful verified reuse, closing the external-permission-drift gap.

### Normalized stream metadata and native timing

P1-03 provides strict native stream normalization based on integer `startPts`/`durationPts` plus rational `timeBase`; decimal `start_time`/`duration` are ignored as authority. P1-07 proves shell-free bounded ffprobe execution. P1-13 proves the same normalization against a real `ffprobe` executable over a generated real video+audio managed original.

### Durable atomic persistence

P1-04 establishes the PostgreSQL media-catalog schema/adapter. P1-10 proves validated asset + source location + managed location + native stream projections commit atomically and injected late stream-write failure rolls the transaction back. P1-11/P1-13 prove end-to-end real runtime durability and idempotent re-ingest.

## P1-14 decision

P1-14 is closed as **Phase-1 gate reconciliation**, not as a newly invented product capability. Adding another identity, metadata or ingest layer solely to reach 14/14 would violate the Bible rule against duplicating existing standalone capabilities.

No new code/config was required and no GitHub Actions run was triggered for this evidence-only closure. Existing exact evidence remains authoritative, particularly:

- Local Stack `32829569480`, job `97744989990`: real FFmpeg/ffprobe + PostgreSQL/Qdrant + durable real-media ingest success;
- Local Stack `32815455771`, job `97702665269`: atomic PostgreSQL commit/rollback success;
- CI `32824631728`, job `97729857134`: managed-original immutable read-only reuse guard success;
- earlier exact CI/runtime evidence for P1-01 through P1-11 recorded in `progress.json` and prior checkpoints.

## Preserved contracts

No canonical contracts changed. Canonical timeline v1/v2 compatibility, centralized media-time rules, renderer-neutral v2 adapter boundary, style profile, delivery profile, structured logging, provenance/rights evidence, immutable revision/render evidence and FFmpeg `-copyts` behavior remain intact.

Stable media identity remains SHA-256 byte-derived and separate from storage location. Native integer PTS plus rational stream time base remain the source timing authority.

## Progress

```text
Standalone verified: 36 / 162 = 22.22%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:     14 / 14  = 100.00% COMPLETE
```

## Next task

Begin Phase 2 with the smallest dependency-correct capability: audit and define a versioned scene-set identity/source-mapping contract. Scene-set revisions must be immutable/versioned, and every scene must map to immutable asset + stream identity with exact native start/end PTS and rational stream time base. Proxy/keyframe generation remains downstream and must not become source-mapping authority.
