# Checkpoint 0097 — Phase-8 editorial-quality baseline verified

## Starting authority

- Starting `main` HEAD: `99c0e3c561bac1b8c2b15542909c92ab18eb8235`.
- Bible revision: `1.2-standalone-ai-editor`.
- Starting progress: `80 / 162 = 49.38%`, Phase 8, P8-03.
- Latest prior checkpoint: `0096-phase8-editorial-quality-evaluation-boundary-verified.md`.

## Task completed

Established the first versioned Phase-8 editorial-quality control benchmark before introducing any Editorial Brain/planning policy upgrade.

Commits:

- `2d741850fe3aeac9c70d8846b665c75ed970db49` — `docs: add phase8 editorial quality baseline`
- `94018535f20fc376ece3349c472a3eb5d0bc0f54` — `test: freeze phase8 editorial quality baseline`

Evidence:

- `docs/ai-editor/benchmarks/phase8-editorial-quality-baseline-v1.md`
- `packages/editorial-quality-library/src/editorial-quality-evaluation.test.ts`

The control reuses the already-versioned immutable fixture `phase8-editorial-quality-fixture:v1`, plan revision `plan-a:r1`, evaluation policy `editorial-quality-evaluation-policy:v1`, and Style Profile `travel-soft-v1` / `1.0.0`.

## Frozen baseline values

- pacing score: `0.6111111111111112` (`11/18`)
- pacing within-bounds rate: `1.0`
- continuity score: `0.5`
- variety score: `0.0`
- shot-type change rate: `0.0`
- movement change rate: `0.0`
- repeat rate: `0.3333333333333333` (`1/3`)
- repeated shot count: `1`
- shot count: `3`

These are measurements, not acceptance thresholds. The intentionally imperfect control is frozen before any planner/scoring/model upgrade so future before/after evidence cannot move the goalposts.

## Contract preservation

- Canonical project timing remains integer project frames + rational FPS.
- Style Profile millisecond preferences remain transient planner-comparison values only.
- No new timing authority was introduced.
- No planner, model, prompt, reranker or scoring-policy upgrade was introduced in P8-03.
- Retrieval relevance remains separate from editorial judgment.
- Existing canonical timeline v1/v2 compatibility, immutable revision/render evidence, renderer-neutral adapter boundary, delivery/style profiles, provenance/rights and prior verified gates remain unchanged.

## Exact validation evidence

One normal CI run was used as the final confidence gate on exact implementation SHA `94018535f20fc376ece3349c472a3eb5d0bc0f54`:

- AI Editor CI run `33052281824`
- job `98450459738`
- dependency install: success
- TypeScript strict gate: success
- Vitest behavioral gate: success
- deterministic migration gate: success
- contract and policy gates: success
- observable commit-status publication: success
- overall run conclusion: `success`

No PostgreSQL/Qdrant local-stack, FFmpeg/media integration, matrix or rerun was used because this slice only freezes deterministic benchmark evidence over the already-verified P8-02 evaluator.

No failed gate was skipped and no unchanged failed job was rerun.

## Progress

- Standalone verified: `81 / 162 = 50.00%`.
- Phase 8: `2` verified slices; exact denominator remains intentionally unspecified pending standalone checklist authority.
- P8-03 is verified.

## Remaining Phase-8 gate

The Bible still requires actual same-fixture before/after evidence of:

- pacing improvement;
- continuity improvement;
- variety improvement;
- lower repeat rate.

P8-03 establishes the immutable control only; it does not claim an Editorial Brain improvement.

## Next task

P8-04 — define the smallest versioned Editorial Brain planning-policy contract bound explicitly to `phase8-editorial-quality-baseline:v1` and Style Profile v1. The policy must be deterministic/versioned and must not be accepted as an upgrade until an after-plan is evaluated against this exact frozen control.
