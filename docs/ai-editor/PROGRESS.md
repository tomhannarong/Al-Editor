# AI Local Footage Editor — Progress

**Repository:** `tomhannarong/Al-Editor` / `main`  
**Phase:** 5 — Hybrid Retrieval + Reranking  
**Current task:** P5-07 — Phase-5 gate reconciliation

```text
Standalone verified: 68 / 162 = 41.98%
Phase 0:             22 / 22  = 100.00% COMPLETE
Phase 1:             14 / 14  = 100.00% COMPLETE
Phase 2:             11 / 11  = 100.00% COMPLETE + GATE VERIFIED
Phase 3:              9 / 9   = 100.00% COMPLETE + GATE VERIFIED
Phase 4:              6 / 6   = 100.00% COMPLETE + GATE VERIFIED
Phase 5:              6 verified slices; denominator not invented before checklist authority
```

## P5-03 — deterministic hybrid retrieval execution

P5-03 remains **verified** on repair commit `0dd6179e55412466378bf09eb8363819da2f1fb4` with AI Editor CI run `32988192562`, job `98239245541`, and exact `ai-editor-ci/all = success`.

## P5-04 — versioned retrieval duplicate-control policy

Implementation commit: `1bbf79e637c4786bd24109429bc69f30c23b2ceb`.

The first CI run `32992622547`, job `98253713871`, failed at strict TypeScript because the intentionally malformed runtime-validator fixture used an intersection that retained the production literal method type. Downstream gates were skipped. This failure was not treated as a pass and the unchanged SHA was not rerun.

Repair commit `6b32226c42f78c993bf96a93908d9b550a75d33a` changed only the negative-test harness by crossing an explicit `unknown` boundary. Production duplicate-control semantics remained unchanged.

Exact repair evidence is now available and P5-04 is **verified**:

- AI Editor CI run `32994487679`
- job `98260037304`
- dependency install: success
- TypeScript strict gate: success
- Vitest behavioral gate: success
- deterministic migrations: success
- contract/policy gates: success
- observable status publication: success
- `ai-editor-ci/all = success`

The policy remains pinned to exact `hybridPolicyRevisionId` lineage and defines deterministic `same-source-interval-iou-v1` suppression over immutable source asset/stream/native-PTS evidence using bounded integer basis-point thresholds. Semantic/perceptual duplicate models, reranking and editorial scoring remain outside this contract.

## P5-05 — deterministic retrieval duplicate-control execution

Implementation commit: `a2532cd464c950cfcb3098cbbf9b2542ece12e92`.  
Test commit: `699e7c7af3e96470e5a34b5d12baf3f89179a753`.

Added `packages/hybrid-retrieval-library/src/duplicate-control.ts` and deterministic tests. Execution now:

- requires duplicate-control policy lineage to match the exact hybrid retrieval policy revision;
- preserves incoming hybrid ranking order;
- suppresses a later candidate only against an already-kept candidate sharing exact immutable asset/stream/index lineage when native-PTS interval IoU is **strictly greater** than the policy threshold;
- keeps exact-threshold equality eligible;
- fails closed when one immutable asset/stream appears with conflicting rational `sourceTimeBase` evidence;
- validates ordered safe-integer native PTS intervals;
- computes integer basis-point IoU using `BigInt` scaling, avoiding decimal-time authority;
- enforces bounded `maxResults` after deterministic suppression;
- returns defensive copies of kept evidence.

Final exact repository evidence:

- AI Editor CI run `32996581754`
- job `98267379517`
- TypeScript strict gate: success
- Vitest behavioral gate: success
- deterministic migrations: success
- contract/policy gates: success
- observable status publication: success
- `ai-editor-ci/all = success`

No PostgreSQL/Qdrant local-stack, FFmpeg media integration, matrix or rerun was used for this pure deterministic slice.

## P5-06 — same-benchmark hybrid + duplicate-control evaluation

Implementation commit: `699615afa2bf3e45e3fa41079d9d8422eb8a9f60`.

Added `packages/hybrid-retrieval-library/src/benchmark-evaluation.ts`, deterministic tests, and `docs/ai-editor/benchmarks/phase5-hybrid-duplicate-control-evaluation-v1.md`.

The evaluator recomputes the exact Phase-4 control, executes the exact pinned Phase-5 weighted-cosine policy, then applies the verified duplicate-control policy over the same immutable scene identities. Relevance labels are resolved to stable scene identity rather than representation-specific indexed-document revisions.

Measured on exact benchmark revision `phase4-labeled-recall-at-10:v1`:

- Phase-4 Macro Recall@10: `0.8333333333333334`
- Phase-5 Macro Recall@10: `1.0`
- Macro gain: `0.16666666666666663`
- Phase-4 Micro Recall@10: `0.75`
- Phase-5 Micro Recall@10: `1.0`
- Micro gain: `0.25`
- relevant labels retrieved: `3/4 -> 4/4`
- per-query Phase-5 Recall@10: `1.0 / 1.0 / 1.0`
- same-benchmark duplicate occupancy before control: `0.0`
- same-benchmark duplicate occupancy after control: `0.0`

The zero duplicate occupancy is an actual property of the immutable Phase-4 fixture because its source intervals do not overlap. P5-05 remains the independent deterministic suppression proof for overlapping same-source intervals; P5-06 does not alter benchmark evidence to fabricate duplicates.

Exact repository evidence:

- AI Editor CI run `33003534039`
- job `98291207703`
- dependency install: success
- TypeScript strict gate: success
- Vitest behavioral gate: success
- deterministic migrations: success
- contract/policy gates: success
- observable status publication: success
- exact `ai-editor-ci/all = success`

No PostgreSQL/Qdrant local-stack, FFmpeg/media integration, matrix or rerun was used because this is deterministic retrieval evaluation over already-verified indexed-scene evidence.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time authority, renderer-neutral adapter boundary, style/delivery/provenance/model contracts, structured logging, immutable revision/render evidence, Phase-1 media durability, Phase-2 scene/proxy/keyframe evidence, Phase-3 transcript/editorial-segment evidence, and the Phase-4 single-vector Recall@10 benchmark remain unchanged.

Retrieval relevance remains separate from editorial judgment. No reranker or Editorial Brain scoring was added because the verified hybrid path already demonstrates measurable gain on the exact control benchmark.

## Phase-5 gate status

The Bible requires **measurable quality gain on the same benchmark plus duplicate control** before advance. Exact evidence now exists for both requirements:

- measurable same-benchmark quality gain: P5-06;
- versioned duplicate-control policy: P5-04;
- deterministic duplicate-control execution: P5-05;
- actual same-benchmark occupancy measurement: P5-06.

Phase 5 is therefore **gate-ready**, not yet declared closed. P5-07 will reconcile these exact proofs against the Bible without adding a redundant capability or Actions run.

## Next task

P5-07: reconcile P5-01 through P5-06 against the Phase-5 Bible gate. If no evidence gap exists, close Phase 5 with a documentation-only commit and no redundant Actions run, then advance to the smallest Phase-6 item in dependency order.
