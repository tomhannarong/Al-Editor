# Checkpoint 0092 — Phase-7 canonical review revision semantics verified

## Starting authority

- Starting `main` HEAD: `14907a2c25a659e37945137ee3e5f02b2294fd19`.
- Bible revision: `1.2-standalone-ai-editor`.
- Starting machine authority: `76 / 162 = 46.91%`, Phase 7, P7-04.
- Latest prior checkpoint: `0091-phase7-human-review-durable-persistence-verified.md`.

## Audit result

`packages/timeline-revision` previously provided only `createShiftedSourceRevisionV2(...)`: an immutable child revision that changes a native source window while requiring the source PTS span to remain unchanged. That was useful historical edit/rerender evidence, but it did not explicitly prove all three Phase-7 human-review edit semantics. In particular, trim needed an intentional source-span/project-frame subset edit, replace needed explicit source-lineage replacement, and lock needed revision-bound state that could prevent later media edits.

No canonical timeline v1/v2 contract was rewritten. The existing v2 timing authority remains integer project frames + rational FPS and native source PTS + rational stream time base.

## P7-04 implementation

Implementation commit: `dbcf7975c539bf0ea8d479d5f804596bfad42419` (`feat: add canonical human review revision semantics`).

Added `createHumanReviewChildRevisionV2(...)` and deterministic tests in `packages/timeline-revision`:

- `replace` creates a distinct immutable child revision, preserves project-frame placement, requires changed asset/source lineage, validates the replacement native source range and requires exact media-duration equivalence across rational source time bases;
- `trim` requires a strict subset of the reviewed item's project-frame and native-PTS ranges and requires both boundaries to move proportionally at the exact existing source-PTS/project-frame rate;
- `lock` creates a distinct immutable child revision without changing media/source content and emits `canonical-review-lock-v1` revision-bound sidecar evidence;
- later replace/trim against a locked item fails closed unless a future explicit unlock capability is versioned separately;
- stale lock evidence bound to a different parent revision is rejected;
- existing `createShiftedSourceRevisionV2(...)` remains available and unchanged in semantics.

## Validation

Local full-repository validation was attempted first, but the execution environment could not resolve `github.com`; this is not counted as a test pass or a code failure.

One normal CI run was used as the final confidence gate:

- AI Editor CI run `33035221247`;
- job `98396369016`;
- dependency install: success;
- TypeScript strict gate: success;
- Vitest behavioral gate: success;
- migration deterministic gate: success;
- contract/policy gates: success;
- observable status publication: success;
- exact status: `ai-editor-ci/all = success` on `dbcf7975c539bf0ea8d479d5f804596bfad42419`.

No PostgreSQL/Qdrant local-stack, FFmpeg/media integration, matrix or rerun was used because P7-04 adds only deterministic canonical revision behavior and no new runtime dependency.

## Progress

- Standalone verified: `77 / 162 = 47.53%`.
- Phase 7: 4 verified slices; denominator remains intentionally unspecified without checklist authority.
- Replace / trim / lock / revision semantics portion of the Phase-7 gate is now satisfied.
- The remaining Phase-7 gate is the first valid HAR measurement.

## Next task

P7-05 — implement the smallest deterministic/versioned Human Acceptance Rate measurement over reviewed human-review decisions. The denominator must be reviewed decisions, review coverage must be separate, and publish-without-edit rate must not be conflated with HAR.
