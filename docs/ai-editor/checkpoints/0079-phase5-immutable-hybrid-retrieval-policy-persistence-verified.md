# Checkpoint 0079 — Phase 5 immutable hybrid retrieval policy persistence verified

## Starting authority

- Starting `main` HEAD: `54281fa1eb5675f0d4050b11550952f5a7c54284`.
- `PROJECT_BIBLE.md` Phase-5 gate requires measurable quality gain on the same benchmark plus duplicate control before advancing.
- `progress.json`, `PROGRESS.md`, `IMPLEMENTATION_MAPPING.md`, and checkpoint 0078 identify P5-02 as the next task.
- The prior P5-01 contract is verified and has no dependent blocker.

## Implemented slice

P5-02 adds `packages/hybrid-retrieval-library/src/index.ts` and deterministic tests.

The persistence boundary treats `revisionId` as immutable evidence identity. Exact semantic re-registration is idempotent, including registration with the same representation set in a different array order. Representation ordering is normalized deterministically before comparison/readback.

Reusing a revision with changed Phase-4 benchmark control, representation/embedding/model revisions, weights, fusion method, candidate pool or `createdAt` fails closed before mutation. A policy upgrade therefore requires a new additive revision ID, while old evidence remains readable. Returned benchmark-control and representation objects are defensive copies.

Runtime candidates, scores, Qdrant state, reranking, duplicate control and editorial scoring remain outside this store.

## Validation / exact evidence

Implementation commit: `3a0efdd40a38a6a7d9b3dcdf7df4d2814a607564`.

AI Editor CI run `32983383147`, job `98225313631`, passed:

- dependency install;
- strict TypeScript;
- Vitest behavioral gate;
- deterministic migrations;
- contract/policy gates;
- observable commit-status publication.

Exact commit status: `ai-editor-ci/all = success`.

No PostgreSQL/Qdrant local-stack, FFmpeg/media integration, matrix or rerun was used because this slice introduces no runtime dependency and the Bible does not require redundant runtime proof for an in-memory immutable policy boundary.

## Preserved invariants

- Phase-4 single-vector Recall@10 benchmark remains the comparison control.
- P5 policy revisions remain versioned and immutable.
- Retrieval relevance remains separate from editorial judgment.
- No canonical timeline or media-time contract changed.
- No decimal-time authority or parallel workflow was introduced.
- Existing Qdrant vectors remain rebuildable index state.
- Canonical v1/v2 compatibility, renderer-neutral adapter boundary, style/delivery/provenance/model contracts, structured logging and immutable revision/render evidence remain unchanged.

## Progress

Standalone verified becomes `64 / 162 = 39.51%`.

- Phase 0: 22/22 complete.
- Phase 1: 14/14 complete.
- Phase 2: 11/11 complete + gate verified.
- Phase 3: 9/9 complete + gate verified.
- Phase 4: 6/6 complete + gate verified.
- Phase 5: 2 verified slices; denominator is not invented before checklist authority.

## Blockers / failures

No code or CI blocker remains for P5-02. Phase 5 remains open because same-benchmark measurable quality gain and duplicate-control evidence do not yet exist.

## Next task

P5-03 — deterministic hybrid retrieval execution. Execute the exact immutable hybrid policy against compatible indexed-scene representation evidence using bounded deterministic weighted-cosine fusion and deterministic tie-breaking. Fail closed on representation/model revision mismatch. Keep reranking, duplicate control and editorial scoring separate, and do not claim quality gain until the same labeled benchmark is measured.
