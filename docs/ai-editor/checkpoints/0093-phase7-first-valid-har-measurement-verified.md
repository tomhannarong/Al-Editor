# Checkpoint 0093 — Phase-7 first valid HAR measurement verified

## Starting authority

- Starting `main` HEAD: `f404ad6e5e3db228a72cece998ba9c1611a70411`.
- Bible revision: `1.2-standalone-ai-editor`.
- Starting machine authority: `77 / 162 = 47.53%`, Phase 7, P7-05.
- Latest prior checkpoint: `0092-phase7-canonical-review-revision-semantics-verified.md`.

## P7-05 implementation

Implementation commit: `15c0eed5480cbad576c422611107592371608786` (`feat: add deterministic human acceptance rate baseline`).

Added `packages/human-review-library/src/har-measurement.ts`, deterministic tests, and `docs/ai-editor/benchmarks/phase7-human-acceptance-rate-baseline-v1.md` in one substantive implementation commit.

The measurement boundary is versioned and fail-closed:

- HAR denominator is reviewed AI decisions only;
- unreviewed eligible AI decisions are excluded rather than counted as rejects;
- one AI decision may contribute at most one durable review decision per measurement revision;
- reviewed and published AI decision IDs must belong to the explicit eligible population;
- every reviewed decision must pass the existing durable human-review decision validator;
- `accept` and `lock` retain the AI media decision under `har-v1`; `replace` and `trim` are reviewed media edits;
- review coverage is reported separately as reviewed / eligible;
- publish-without-edit is reported separately over published AI decisions and does not alter HAR;
- measurement evidence carries decision/revision IDs only and does not duplicate canonical project frames, source PTS, rational time bases, or source mapping.

## First valid measurement fixture

Versioned fixture: `human-acceptance-rate:phase7-baseline:v1`.

- eligible AI decisions: 6;
- reviewed decisions: 4;
- actions: 1 accept, 1 lock, 1 trim, 1 replace;
- accepted/retained reviewed decisions: 2;
- reviewed edits: 2;
- HAR: `0.50` = `2 / 4`;
- review coverage: `0.6666666666666666` = `4 / 6`;
- published AI decisions: 5;
- publish-without-edit: `0.80` = `4 / 5`.

This is a deterministic baseline measurement, not an acceptance threshold and not a claim about production-user behavior.

## Validation

The implementation was committed once; no intermediate broken SHA was pushed. One normal CI run was used as the final confidence gate:

- AI Editor CI run `33038039987`;
- job `98405091769`;
- dependency install: success;
- TypeScript strict gate: success;
- Vitest behavioral gate: success;
- migration deterministic gate: success;
- contract/policy gates: success;
- observable status publication: success;
- exact status: `ai-editor-ci/all = success` on `15c0eed5480cbad576c422611107592371608786`.

No PostgreSQL/Qdrant local-stack, FFmpeg/media integration, matrix or rerun was used because P7-05 is a deterministic evaluation boundary over already-verified durable review-decision evidence.

## Progress

- Standalone verified: `78 / 162 = 48.15%`.
- Phase 7: 5 verified slices; denominator remains intentionally unspecified without separate checklist authority.
- The Bible Phase-7 requirements `replace/trim/lock/revision semantics` and `first valid HAR measurement` now both have exact standalone evidence.

## Next task

P7-06 — reconcile P7-01 through P7-05 exact evidence against the Phase-7 gate. If no gap exists, close Phase 7 with documentation-only evidence and advance to the smallest independent Phase-8 item without spending another Actions run solely for redundant proof.
