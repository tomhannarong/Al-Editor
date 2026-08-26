# AI Local Footage Editor — Progress

**Repository:** `tomhannarong/Al-Editor` / `main`  
**Phase:** 4 — Baseline Scene Retrieval  
**Current task:** P4-05 — labeled Recall@10 baseline

```text
Standalone verified: 60 / 162 = 37.04%
Phase 0:             22 / 22  = 100.00% COMPLETE
Phase 1:             14 / 14  = 100.00% COMPLETE
Phase 2:             11 / 11  = 100.00% COMPLETE + GATE VERIFIED
Phase 3:              9 / 9   = 100.00% COMPLETE + GATE VERIFIED
Phase 4:              4 verified slices; denominator not invented before checklist audit
```

## Phase 4 — P4-04 verified

P4-04 adds the selective real-Qdrant indexed-scene durability boundary required before a labeled retrieval benchmark can be trusted. `packages/indexed-scene-library/src/qdrant.ts` validates immutable indexed-scene metadata plus the source embedding digest before mutation, derives deterministic RFC-versioned UUID point identity from `revisionId`, normalizes rational source-time evidence, reads existing point evidence before upsert, makes exact semantic re-registration idempotent and fails closed on conflicting immutable payload evidence.

A critical runtime distinction is now explicit: Qdrant `Cosine` collections normalize vectors during upload. Therefore `embedding.vectorSha256` remains immutable evidence of the source embedding supplied to the index boundary, while Qdrant's stored normalized vector is rebuildable index state. Readback validates finite dimensions and cosine-direction equivalence instead of incorrectly requiring byte-identical source-vector digest equality. Canonical scene/source/native-PTS evidence remains unchanged.

## Exact evidence and failures

Implementation commit `14da2da5f4c704444569f783cddc88de395dc472` introduced the typed Qdrant store, deterministic tests, real runtime verifier and selective workflow integration. Initial Local Stack run `32960978717`, job `98153030354`, failed at the new Qdrant verifier; Docker/PostgreSQL/Qdrant boot had passed. No unchanged rerun was used.

`ddf924ff9ea50f6ad2bc22e85d206fcc24a99f92` switched readback to explicit multi-point retrieval, but Local Stack run `32961271833`, job `98153922900`, still failed at the Qdrant verifier. `461ad57f6a50e45e2e7159d15d6e0401bcfe8cd1` emitted deterministic RFC-versioned UUIDs; Local Stack run `32961560696`, job `98154796035`, still failed. Each retry followed a code/config change rather than rerunning an unchanged failure.

Diagnostic commit `e8fcebe2ae5a386fbe5633c6ef3089d4b0202d27` separated a raw REST point round-trip from the typed boundary and moved FFmpeg setup after Qdrant to save runner time on future failures. Local Stack run `32961730784`, job `98155333282`, proved the raw Qdrant REST point round-trip passed while the typed boundary failed, isolating the defect from container/network availability.

The root-cause repair is commit `19f3fbe097a4b626be8136534e226a54ece49f9b`: source-vector digest validation now happens before index mutation, while Qdrant's cosine-normalized readback is treated as rebuildable state and checked for dimensions/direction. Exact final evidence:

- AI Editor CI run `32961921478`, job `98155939002`: strict TypeScript, Vitest, deterministic migrations, contract/policy gates and observable status all passed.
- AI Editor Local Stack Gate run `32961921586`, job `98155939837`: Docker + PostgreSQL/Qdrant boot, raw REST smoke, typed real-Qdrant durability, PostgreSQL regressions, real FFmpeg derivative regressions, API health, cleanup and status publication all passed.
- Exact commit statuses: `ai-editor-ci/all = success` and `ai-editor-local-stack/all = success`.

No failed gate was relabeled as a runner failure or test pass. The unavailable external local clone environment was not used as evidence.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time authority, renderer-neutral v2 adapter boundary, style/delivery/provenance/model contracts, structured logging, immutable revision/render evidence, Phase-1 media durability, Phase-2 scene/proxy/keyframe evidence and Phase-3 transcript/editorial-segment evidence remain unchanged.

Retrieval relevance remains separate from editorial judgment. No Phase-5 hybrid weights or reranker behavior were introduced.

## Next task

P4-05 — establish a deterministic, versioned labeled Recall@10 baseline over actual indexed-scene documents and the baseline query contract. The benchmark must report evidence rather than invent an acceptance threshold, preserve exact scene/source lineage, and remain pure baseline retrieval without Phase-5 hybrid/reranking behavior.
