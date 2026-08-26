# Checkpoint 0086 — Phase-6 exact frame/source mapping golden verified

## Starting authority

- Starting `main` HEAD: `6770693cb93f63349064b7642e85d8b2e39363a2`.
- Phase 5 was verified-complete at 69/162 standalone items.
- Bible Phase-6 gate requires `exact frame/source mapping goldens` plus `preview/final delivery validation`.
- Starting docs-only HEAD had no Actions run, consistent with path filters.

## Audit result

Existing standalone evidence already covered centralized media-time conversion goldens, rational project FPS, native source PTS/time bases, non-zero PTS handling, renderer-neutral preview mapping and `-copyts`. The concrete missing evidence was a single cross-layer golden tying one canonical clip's exact project-frame span to the same clip's native source-PTS span and then to preview adapter argv.

No canonical contract change was required.

## P6-01 implementation

Implementation commit: `72780c37b5456fa4a31fdfdacca8023c6e79fcd2`.

Added `docs/ai-editor/benchmarks/phase6-frame-source-mapping-golden-v1.md` and extended `packages/preview-renderer/src/index.test.ts` with a fractional-FPS/non-zero-PTS golden:

- project rate: `30000/1001`;
- project frames: `[0, 90)`, span `90`;
- source time base: `1/30000`;
- source PTS: `[29010, 119100)`, span `90090`;
- both spans represent exactly `3.003s`;
- centralized conversion round-trip proves `90 frames <-> 90090 PTS`;
- renderer plan consumes absolute `trim=start_pts=29010:end_pts=119100`.

This preserves integer project frames + rational FPS and native PTS + rational source time base as the only canonical timing authorities.

## Validation

One normal CI run was used as the final confidence gate because package test code changed:

- AI Editor CI run `33013977827`;
- job `98327280374`;
- dependency install: success;
- TypeScript strict: success;
- Vitest behavioral gate: success;
- deterministic migrations: success;
- contract/policy gates: success;
- observable status publication: success;
- exact `ai-editor-ci/all = success` on `72780c37b5456fa4a31fdfdacca8023c6e79fcd2`.

No unchanged rerun, matrix, PostgreSQL/Qdrant local-stack or heavyweight FFmpeg runtime was used for this deterministic mapping slice.

## Preserved baseline

Canonical timeline v1/v2 compatibility, centralized media-time rules, renderer-neutral v2 adapter boundary, delivery/style profiles, structured logging, provenance/rights work, immutable revision/render evidence, and verified Phase-1 through Phase-5 evidence remain unchanged.

## Progress

Standalone verified becomes `70 / 162 = 43.21%`.

Phase 6 has one verified slice. No Phase-6 denominator is invented without checklist authority.

## Next task

`P6-02-phase6-preview-final-delivery-validation-audit`: reconcile existing real preview, immutable rerender and delivery-profile evidence against the remaining Phase-6 gate. Spend a selective heavyweight FFmpeg run only if the audit identifies a concrete preview/final delivery proof gap.
