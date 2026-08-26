# Checkpoint 0075 — Phase 4 real Qdrant indexed-scene durability verified

## Starting authority

- Starting `main` HEAD: `11acc4a4bb2074ac4cfa72dd9bdedca41a63e906`.
- `PROJECT_BIBLE.md` Phase-4 gate requires a versioned query schema, actual indexed scenes and a labeled Recall@10 baseline before advancing.
- P4-01 through P4-03 were already verified; P4-04 was the smallest dependent missing slice.

## Implementation

Initial implementation commit `14da2da5f4c704444569f783cddc88de395dc472` added:

- `packages/indexed-scene-library/src/qdrant.ts`
- `packages/indexed-scene-library/src/qdrant.test.ts`
- `infra/verify-qdrant-indexed-scene-runtime.mts`
- selective integration in `.github/workflows/local-stack-gate.yml`

The boundary preserves immutable indexed-scene payload evidence while Qdrant remains rebuildable vector-index state. Source vector dimensions and `vectorSha256` are validated before mutation; deterministic point identity derives from immutable revision identity; exact semantic re-registration is idempotent; conflicting payload evidence fails closed before overwrite.

## Failed gates and repairs

1. Local Stack run `32960978717`, job `98153030354`, failed at the new Qdrant verifier after Docker/PostgreSQL/Qdrant boot passed. No unchanged rerun.
2. Commit `ddf924ff9ea50f6ad2bc22e85d206fcc24a99f92` switched to explicit multi-point retrieval. Local Stack run `32961271833`, job `98153922900`, still failed. No unchanged rerun.
3. Commit `461ad57f6a50e45e2e7159d15d6e0401bcfe8cd1` emitted RFC-versioned deterministic UUID point IDs. Local Stack run `32961560696`, job `98154796035`, still failed. No unchanged rerun.
4. Diagnostic commit `e8fcebe2ae5a386fbe5633c6ef3089d4b0202d27` separated raw REST point round-trip from the typed verifier and moved FFmpeg installation after the Qdrant gate. Local Stack run `32961730784`, job `98155333282`, proved raw Qdrant REST operations succeeded while the typed boundary failed.
5. Root cause: the collection uses `Cosine`, and Qdrant normalizes vectors on upload. Treating the stored vector as byte-identical immutable source-vector evidence was incorrect. Commit `19f3fbe097a4b626be8136534e226a54ece49f9b` repaired the contract boundary: immutable `vectorSha256` authenticates source embedding input before mutation; Qdrant-normalized readback is rebuildable state and is checked for dimensions plus cosine-direction equivalence.

No unavailable runner was claimed as a pass or code failure, and no failed SHA was rerun without a code/config reason.

## Exact final evidence

Exact implementation/runtime-repair SHA: `19f3fbe097a4b626be8136534e226a54ece49f9b`.

- AI Editor CI run `32961921478`, job `98155939002`: success. Strict TypeScript, Vitest, deterministic migrations, contract/policy gates and status publication all passed.
- AI Editor Local Stack Gate run `32961921586`, job `98155939837`: success. Docker runtime, PostgreSQL/Qdrant boot, raw Qdrant REST point round-trip, typed real-Qdrant indexed-scene durability, PostgreSQL regressions, real FFmpeg derivative regressions, API health, cleanup and status publication all passed.
- Exact commit statuses: `ai-editor-ci/all = success`; `ai-editor-local-stack/all = success`.

## Invariants preserved

- Canonical timeline v1/v2 and native PTS/rational time-base authority are unchanged.
- Scene/index payloads retain exact immutable asset/stream/scene/native-PTS lineage.
- `embedding.vectorSha256` is immutable source-embedding evidence validated before Qdrant mutation.
- Qdrant's cosine-normalized vector bytes are rebuildable index state, not canonical source evidence.
- Exact semantic re-upsert is idempotent; conflicting immutable revision evidence fails closed before Qdrant overwrite.
- Retrieval relevance remains separate from editorial judgment; no Phase-5 hybrid/reranker behavior was introduced.

## Progress

Standalone verified: `60 / 162 = 37.04%`.

Phase 0 remains 22/22 complete; Phase 1 remains 14/14 complete; Phase 2 remains 11/11 complete with gate evidence; Phase 3 remains 9/9 complete with gate evidence. Phase 4 now has four verified slices; its checklist denominator is not invented without authority.

## Next task

P4-05 — deterministic, versioned labeled Recall@10 baseline over actual indexed-scene documents and the baseline query contract. This should be an evaluation slice, not Phase-5 hybrid/reranking work, and should report a measured baseline without inventing an acceptance threshold.
