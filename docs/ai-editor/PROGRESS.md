# AI Local Footage Editor — Progress

**Repository:** `tomhannarong/Al-Editor` / `main`  
**Phase:** 5 — Hybrid Retrieval + Reranking  
**Current task:** P5-06 — Same-benchmark hybrid + duplicate-control evaluation

```text
Standalone verified: 67 / 162 = 41.36%
Phase 0:             22 / 22  = 100.00% COMPLETE
Phase 1:             14 / 14  = 100.00% COMPLETE
Phase 2:             11 / 11  = 100.00% COMPLETE + GATE VERIFIED
Phase 3:              9 / 9   = 100.00% COMPLETE + GATE VERIFIED
Phase 4:              6 / 6   = 100.00% COMPLETE + GATE VERIFIED
Phase 5:              5 verified slices; denominator not invented before checklist authority
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
- fails closed when one immutable asset/stream appears with conflicting rational source-time-base evidence;
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

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time authority, renderer-neutral adapter boundary, style/delivery/provenance/model contracts, structured logging, immutable revision/render evidence, Phase-1 media durability, Phase-2 scene/proxy/keyframe evidence, Phase-3 transcript/editorial-segment evidence, and the Phase-4 single-vector Recall@10 benchmark remain unchanged.

Retrieval relevance remains separate from editorial judgment. Phase 5 still requires **measurable quality gain on the same Phase-4 benchmark plus duplicate-control evidence** before advancing. P5-04/P5-05 now provide policy + execution evidence for deterministic duplicate control, but no quality-gain claim has been made yet.

## Next task

P5-06: evaluate the verified hybrid retrieval + duplicate-control path on the exact versioned Phase-4 labeled benchmark. Record Recall@10 and duplicate occupancy/control evidence using the same benchmark control revision. Do not invent an acceptance threshold and do not claim a quality gain unless the measured result actually improves the relevant benchmark evidence. If the hybrid + duplicate-control path does not improve quality, preserve that result and implement the smallest reranking capability needed before another versioned benchmark comparison.
