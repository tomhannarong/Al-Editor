# Checkpoint 0047 — Phase 1 durable filesystem-to-PostgreSQL ingest composition verified

Date: 2026-08-25 (Asia/Bangkok)

Starting HEAD: `83a67159bb0f71a59be333d53f3b645b29ffdc32`.

## Audit

This continuation re-read `PROJECT_BIBLE.md`, `docs/ai-editor/progress.json`, `docs/ai-editor/PROGRESS.md`, `docs/ai-editor/IMPLEMENTATION_MAPPING.md`, checkpoint 0046, exact `main` HEAD and the P1-10 CI/runtime evidence before modifying the repository.

P1-10 was complete and validated. The smallest remaining dependency-correct Phase-1 gap was not another identity or metadata implementation; it was real composition proof that the existing durable orchestration can run from a confined local file through managed immutable storage and native metadata normalization into the already verified atomic PostgreSQL commit boundary.

## P1-11 — durable filesystem-to-PostgreSQL ingest composition

Implementation/runtime-proof commit `fea5a180e8a7b3b98d018d7bbc6f8aafd2845033` (`test: prove durable local ingest on PostgreSQL`) adds:

- `infra/verify-postgres-durable-ingest-runtime.mts`
- a minimal update to `.github/workflows/local-stack-gate.yml` so the existing selective PostgreSQL runtime job executes the new verifier after the lower-level media-catalog verifier.

The new verifier:

1. creates a real temporary allowed source root and managed root;
2. writes a real local source file;
3. calls `ingestImmutableLocalMediaDurably(...)` with a real `PostgresMediaCatalog`;
4. reuses the existing confined source hashing and stable file snapshot checks;
5. materializes and byte-verifies the content-addressed managed original;
6. injects deterministic ffprobe JSON through the existing process-executor seam and asserts ffprobe targets the verified managed-original path;
7. persists normalized native video/audio PTS and rational time bases through the existing atomic PostgreSQL transaction;
8. verifies PostgreSQL readback for the immutable asset, source location, managed location and stream projection;
9. runs the exact same ingest again and proves the managed content path is reused rather than duplicated;
10. verifies PostgreSQL still contains one asset, two locations and two streams for the re-ingested bytes.

The ffprobe fixture deliberately includes decimal `start_time`/`duration` on video, but the runtime assertions only observe the previously authoritative integer PTS and rational stream time bases. No decimal timing authority is introduced.

## Validation

Only the selective local-stack workflow was triggered because this commit changes only the runtime verifier and its selective workflow entry. Normal CI did not run, avoiding redundant free-tier usage; all composed package code already has exact normal CI evidence from P1-05 through P1-10.

Exact runtime evidence:

- AI Editor Local Stack Gate run `32819714185`
- job `97715097100`
- exact SHA `fea5a180e8a7b3b98d018d7bbc6f8aafd2845033`
- deterministic verifier control-flow check: success
- API health contract check: success
- Docker runtime: success
- PostgreSQL + Qdrant boot/health: success
- runtime verifier dependencies: success
- PostgreSQL media catalog + durable ingest runtime step: success
- API health against real dependencies: success
- cleanup: success
- observable status publication: success
- exact commit status: **`ai-editor-local-stack/all = success`**

The durable verifier emitted its success only after the real filesystem/PostgreSQL composition and idempotent second ingest completed.

No unchanged failed workflow was rerun. No matrix or FFmpeg real-media workflow was triggered.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time authority, renderer-neutral v2 adapter boundary, style profile, delivery profile, structured logging, provenance/rights, immutable revision/render evidence and FFmpeg `-copyts` behavior remain unchanged.

Stable asset identity remains SHA-256 byte-derived and separate from storage location. Managed original paths remain content-addressed. Native integer PTS plus rational stream time base remain source timing authority. The new runtime proof adds no second ingest, persistence or timing implementation.

## Progress

```text
Standalone verified: 33 / 162 = 20.37%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:     11 / 14  = 78.57%
```

## Next task

Audit the three remaining Phase-1 checklist items against the now-verified real durable ingest path and choose the smallest independent dependency-correct gap. Do not start Phase-2 derivatives until Phase 1 is explicitly resolved and evidenced.
