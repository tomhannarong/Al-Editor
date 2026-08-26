# Checkpoint 0078 — Phase 5 versioned hybrid retrieval policy verified

## Starting authority

- Starting `main` HEAD: `411b11cf0e0d27d82061ef5e1d1f61726732def5`.
- `PROJECT_BIBLE.md` Phase-5 gate requires measurable quality gain on the same benchmark plus duplicate control before advancing.
- `docs/ai-editor/progress.json`, `PROGRESS.md`, `IMPLEMENTATION_MAPPING.md`, and checkpoint 0077 identify P5-01 as the next task.
- Starting HEAD is documentation-only with no status checks by design; the immediately preceding Phase-4 implementation SHA has exact passing CI evidence.

## Implemented slice

P5-01 adds `packages/contracts/src/hybrid-retrieval-policy.contract.ts`, its deterministic tests, and the contracts barrel export.

The contract pins:

1. exact Phase-4 benchmark control identity and revision;
2. policy/revision identity;
3. at least two representation revisions;
4. embedding revision + model ID/version per representation;
5. deterministic integer basis-point weights summing exactly to 10,000;
6. explicit `weighted-cosine-score-v1` fusion method;
7. bounded candidate-pool size;
8. immutable creation evidence.

Reranking, duplicate-control behavior and editorial scoring are deliberately absent. This slice makes no quality-gain claim.

## Validation / exact evidence

Local clone/test was attempted before persistence, but the execution environment could not resolve `github.com`. This is not counted as a pass or code failure.

Implementation commit: `92e06e995290568d82632a1259a3b51c369dcf82`.

AI Editor CI run `32977400310`, job `98205379475`, passed:

- dependency install;
- strict TypeScript;
- Vitest behavioral gate;
- deterministic migrations;
- contract/policy gates;
- observable commit-status publication.

Exact commit status: `ai-editor-ci/all = success`.

No PostgreSQL/Qdrant local-stack, FFmpeg/media integration, matrix or rerun was used because P5-01 is a contract-only deterministic slice. No unchanged failed job was rerun.

## Preserved invariants

- Phase-4 single-vector benchmark remains the comparison control.
- Retrieval relevance remains separate from editorial judgment.
- No canonical timeline/media-time contract changed.
- No new decimal-time or parallel workflow authority was introduced.
- Qdrant vectors remain rebuildable index state; representation/model revisions are explicit policy evidence.
- Existing style/delivery/provenance/model contracts, structured logging, immutable revision/render evidence and migrated CIOS provenance remain unchanged.

## Progress

Standalone verified becomes `63 / 162 = 38.89%`.

- Phase 0: 22/22 complete.
- Phase 1: 14/14 complete.
- Phase 2: 11/11 complete + gate verified.
- Phase 3: 9/9 complete + gate verified.
- Phase 4: 6/6 complete + gate verified.
- Phase 5: 1 verified slice; denominator is not invented before checklist authority.

## Blockers / failures

No code or CI blocker remains for P5-01. Phase 5 itself remains open because measurable same-benchmark quality gain and duplicate-control evidence do not yet exist.

## Next task

P5-02 — immutable hybrid retrieval policy persistence/idempotency. Exact semantic re-registration of an existing revision must be idempotent. Reusing `revisionId` with changed benchmark control, representation/embedding/model evidence, weights, fusion method, candidate pool or creation evidence must fail closed before mutation. Do not claim quality gain until later benchmark evidence exists.
