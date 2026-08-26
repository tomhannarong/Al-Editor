# Checkpoint 0083 — Phase-5 duplicate-control policy and execution verified

## Starting authority

- Starting `main` HEAD: `25d708e6bcf51775d750b1ff296dda14d2f6c26b`.
- `PROJECT_BIBLE.md` Phase-5 gate still requires measurable quality gain on the same benchmark plus duplicate control before advancing.
- `progress.json`, `PROGRESS.md`, `IMPLEMENTATION_MAPPING.md`, and checkpoint 0082 identified P5-04 exact repair validation as the immediate unfinished task.
- Standalone verified count at start: `65 / 162 = 40.12%`.

## P5-04 exact validation resolved

Repair SHA `6b32226c42f78c993bf96a93908d9b550a75d33a` now has exact repository CI evidence:

- AI Editor CI run `32994487679`
- job `98260037304`
- Install dependencies: success
- TypeScript strict gate: success
- Vitest behavioral gate: success
- Migration deterministic gate: success
- Contract and policy gates: success
- Publish observable commit status: success
- exact `ai-editor-ci/all = success`

The earlier implementation SHA `1bbf79e637c4786bd24109429bc69f30c23b2ceb` remains recorded as a real strict-TypeScript failure. It was not rerun unchanged. Repair `6b32226c` changed only the intentionally-invalid test harness and did not alter production duplicate-control semantics.

P5-04 is therefore verified.

## P5-05 implementation

Selected the smallest direct dependent slice: deterministic duplicate-control execution over verified hybrid retrieval results.

Implementation commit:

- `a2532cd464c950cfcb3098cbbf9b2542ece12e92` — `feat: execute deterministic retrieval duplicate control`

Test commit:

- `699e7c7af3e96470e5a34b5d12baf3f89179a753` — `test: cover deterministic retrieval duplicate control`

Files:

- `packages/hybrid-retrieval-library/src/duplicate-control.ts`
- `packages/hybrid-retrieval-library/src/duplicate-control.test.ts`

The two related pushes were intentionally issued back-to-back under the repository's existing `concurrency: cancel-in-progress: true` workflow policy to minimize runner waste while using the available single-file GitHub contents write boundary.

## P5-05 invariants

- execution requires exact `hybridPolicyRevisionId` equality between duplicate-control policy and hybrid retrieval evidence;
- incoming hybrid ranking order is preserved;
- a later candidate is suppressed only against an already-kept candidate sharing exact immutable asset/stream/index lineage;
- source interval overlap is evaluated in native integer PTS only;
- same-stream conflicting rational `sourceTimeBase` evidence fails closed;
- suppression uses strictly-greater-than threshold semantics, so exact threshold equality remains eligible;
- interval IoU uses `BigInt` integer basis-point scaling, avoiding decimal-time authority and unsafe multiplication drift;
- `maxResults` is bounded by the versioned policy and enforced after deterministic suppression;
- kept evidence is defensively copied;
- semantic/perceptual duplicate models, reranking and editorial scoring remain outside this execution boundary.

Canonical timeline v1/v2 compatibility, centralized media-time rules, renderer-neutral adapters, style/delivery/provenance/model contracts, structured logging and immutable revision/render evidence remain unchanged.

## Exact P5-05 validation

AI Editor CI run `32996581754`, job `98267379517`, on exact test SHA `699e7c7af3e96470e5a34b5d12baf3f89179a753` completed successfully:

- Install dependencies: success
- TypeScript strict gate: success
- Vitest behavioral gate: success
- Migration deterministic gate: success
- Contract and policy gates: success
- Publish observable commit status: success
- exact `ai-editor-ci/all = success`

No PostgreSQL/Qdrant local-stack, FFmpeg/media integration, matrix or unchanged rerun was used because this is a pure deterministic retrieval slice.

## Progress

Standalone verified is now `67 / 162 = 41.36%`.

- Phase 0: 22/22 complete.
- Phase 1: 14/14 complete.
- Phase 2: 11/11 complete + gate verified.
- Phase 3: 9/9 complete + gate verified.
- Phase 4: 6/6 complete + gate verified.
- Phase 5: P5-01 through P5-05 verified; denominator remains intentionally unspecified until checklist authority exists.

## Remaining Phase-5 gate

Duplicate-control policy + deterministic execution evidence now exists, but the Bible gate is **not yet closed**. No measurable quality gain has been claimed.

## Next task

P5-06: evaluate verified hybrid retrieval plus duplicate control against the exact versioned Phase-4 labeled Recall@10 benchmark. Record Recall@10 and duplicate occupancy/control evidence without inventing an acceptance threshold. If the measured system does not improve quality over the Phase-4 control, preserve that evidence and implement the smallest reranking capability needed before another versioned comparison.
