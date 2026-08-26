# Checkpoint 0084 — Phase-5 same-benchmark hybrid + duplicate-control evaluation verified

## Starting authority

- Starting `main` HEAD: `29ece8df30a88cf5a5c44b5ffe3eace4ec61adff`.
- `PROJECT_BIBLE.md` Phase-5 gate requires measurable quality gain on the same benchmark plus duplicate control before advance.
- P5-01 through P5-05 were verified; no measurable quality-gain claim had yet been accepted.
- Standalone verified count at start: `67 / 162 = 41.36%`.

## P5-06 implementation

Selected the smallest unfinished Phase-5 gate item: evaluate the already-verified hybrid + duplicate-control path against the exact versioned Phase-4 labeled benchmark before introducing a reranker.

Implementation commit:

- `699615afa2bf3e45e3fa41079d9d8422eb8a9f60` — `feat: evaluate phase5 hybrid retrieval benchmark`

Files:

- `packages/hybrid-retrieval-library/src/benchmark-evaluation.ts`
- `packages/hybrid-retrieval-library/src/benchmark-evaluation.test.ts`
- `docs/ai-editor/benchmarks/phase5-hybrid-duplicate-control-evaluation-v1.md`

The evaluator first recomputes `phase4-labeled-recall-at-10:v1`, maps relevance labels to immutable scene identity, executes the pinned hybrid policy, applies duplicate control, and reports Recall@10 plus actual duplicate occupancy. Native source PTS/rational time base remain unchanged source authority. No reranker or editorial scoring is introduced.

## Measured result

Exact Phase-4 control:

- Macro Recall@10 = `0.8333333333333334`
- Micro Recall@10 = `0.75`
- relevant labels retrieved = `3 / 4`

Phase-5 hybrid + duplicate control:

- Macro Recall@10 = `1.0`
- Micro Recall@10 = `1.0`
- relevant labels retrieved = `4 / 4`
- Macro gain = `0.16666666666666663`
- Micro gain = `0.25`
- per-query recall = `1.0 / 1.0 / 1.0`
- duplicate occupancy before control = `0.0`
- duplicate occupancy after control = `0.0`

The Phase-4 fixture contains non-overlapping source intervals, so zero duplicate occupancy is the measured benchmark property. P5-05 remains the exact deterministic evidence that overlapping same-source candidates are suppressed above the versioned native-PTS IoU threshold.

## Exact validation

AI Editor CI run `33003534039`, job `98291207703`, on exact implementation SHA `699615afa2bf3e45e3fa41079d9d8422eb8a9f60` completed successfully:

- dependency install: success
- TypeScript strict: success
- Vitest behavioral gate: success
- deterministic migrations: success
- contract/policy gates: success
- observable status publication: success
- exact `ai-editor-ci/all = success`

No PostgreSQL/Qdrant local-stack, FFmpeg/media integration, matrix or unchanged rerun was used.

## Preserved baseline

Canonical timeline v1/v2 compatibility, centralized media-time rules, renderer-neutral v2 adapter boundary, style/delivery profiles, structured logging, provenance/rights work, immutable revision/render evidence, and all verified Phase-1 through Phase-4 evidence remain unchanged. Retrieval relevance is still separate from editorial judgment.

## Gate interpretation

P5-06 supplies the previously missing measurable quality-gain evidence on the same versioned Phase-4 benchmark. P5-04/P5-05 already supply duplicate-control policy/execution evidence. Therefore the explicit Phase-5 proof requirements are now present, but closure is intentionally deferred to one documentation-only reconciliation item rather than silently advancing the phase in the implementation run.

## Progress

Standalone verified is now `68 / 162 = 41.98%`.

- Phase 0: 22/22 complete.
- Phase 1: 14/14 complete.
- Phase 2: 11/11 complete + gate verified.
- Phase 3: 9/9 complete + gate verified.
- Phase 4: 6/6 complete + gate verified.
- Phase 5: P5-01 through P5-06 verified; denominator remains intentionally unspecified until checklist authority exists.

## Next task

P5-07: reconcile P5-01 through P5-06 exact evidence against the Bible Phase-5 gate. If no gap exists, close Phase 5 without a redundant Actions run and advance to the smallest Phase-6 item in dependency order.
