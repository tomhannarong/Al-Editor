# AI Local Footage Editor — Progress

**Repository:** `tomhannarong/Al-Editor` / `main`  
**Phase:** 9 — Evaluation + Preference Learning  
**Current task:** P9-04 — versioned regression-gate contract

```text
Standalone verified: 87 / 162 = 53.70%
Phase 0:             22 / 22  = 100.00% COMPLETE
Phase 1:             14 / 14  = 100.00% COMPLETE
Phase 2:             11 / 11  = 100.00% COMPLETE + GATE VERIFIED
Phase 3:              9 / 9   = 100.00% COMPLETE + GATE VERIFIED
Phase 4:              6 / 6   = 100.00% COMPLETE + GATE VERIFIED
Phase 5:              7 / 7   = 100.00% COMPLETE + GATE VERIFIED
Phase 6:              4 / 4   = 100.00% COMPLETE + GATE VERIFIED
Phase 7:              6 / 6   = 100.00% COMPLETE + GATE VERIFIED
Phase 8:              6 verified slices; GATE VERIFIED
Phase 9:              2 verified slices; denominator intentionally unspecified pending checklist authority
```

## P9-03 verified — immutable experiment-registry persistence/idempotency

Implementation `0890b33caaf3573f3491aa3f344edf966524ab67` adds `packages/experiment-registry-library/src/index.ts` and deterministic tests.

The persistence boundary validates every revision before mutation, treats exact semantic re-registration of the same `revisionId` as idempotent, returns deep defensive copies, preserves additive historical revisions, and fails closed when the same immutable revision identity is reused with changed benchmark/control, candidate policy/model/prompt/execution-profile, evaluation/result evidence, or execution timestamps.

Raw model artifacts, prompt templates, benchmark/result payloads and credentials remain outside the registry; P9-03 persists only the pinned experiment evidence references established by P9-02.

Exact final-confidence evidence: AI Editor CI run `33074640900`, job `98525532483`; dependency install, strict TypeScript, Vitest, deterministic migrations, contract/policy gates and observable status publication all succeeded. Exact commit status `ai-editor-ci/all = success` is published for `0890b33c...`.

No PostgreSQL/Qdrant local-stack, FFmpeg/media workflow, matrix or unchanged rerun was used because this slice adds no runtime dependency.

## Phase 9 audit retained

P9-01 established that versioned benchmark evidence already exists and that the existing AI model registry must be reused. P9-02/P9-03 now cover versioned experiment identity and immutable idempotent registration semantics. The genuine remaining explicit Phase-9 gate gap is regression gating. No Phase-9 denominator is invented.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time rules, renderer-neutral v2 adapter boundary, immutable media/revision/render evidence, Style Profile v1, Delivery Profile v1, structured logging, provenance/rights, retrieval/editorial separation and all verified Phase-0 through Phase-8 evidence remain unchanged.

## Next task

P9-04 — implement the smallest versioned regression-gate contract. It must bind an exact benchmark/control plus candidate experiment/result revision, define explicit metric direction/tolerance semantics, reject mutable aliases, and remain an evaluation decision boundary rather than creating a parallel benchmark/model registry. Execution/persistence of the gate remains subsequent evidence if required.
