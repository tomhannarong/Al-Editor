# AI Local Footage Editor — Progress

**Repository:** `tomhannarong/Al-Editor` / `main`  
**Phase:** 9 — Evaluation + Preference Learning  
**Current task:** P9-02 — versioned experiment-registry contract

```text
Standalone verified: 85 / 162 = 52.47%
Phase 0:             22 / 22  = 100.00% COMPLETE
Phase 1:             14 / 14  = 100.00% COMPLETE
Phase 2:             11 / 11  = 100.00% COMPLETE + GATE VERIFIED
Phase 3:              9 / 9   = 100.00% COMPLETE + GATE VERIFIED
Phase 4:              6 / 6   = 100.00% COMPLETE + GATE VERIFIED
Phase 5:              7 / 7   = 100.00% COMPLETE + GATE VERIFIED
Phase 6:              4 / 4   = 100.00% COMPLETE + GATE VERIFIED
Phase 7:              6 / 6   = 100.00% COMPLETE + GATE VERIFIED
Phase 8:              6 verified slices; GATE VERIFIED
Phase 9:              started; P9-01 audit complete; denominator intentionally unspecified pending checklist authority
```

## Phase 9 audit complete — evaluation, experiment registry, regression gate

P9-01 audited the exact `main` HEAD `b7c5372f708b68ffa294dd4a325eb160d5c4b73a` before making any Phase-9 capability change.

The Bible requires three Phase-9 proofs before advance:

- versioned benchmark;
- experiment registry;
- regression gate.

### Existing evidence to reuse

Versioned benchmark evidence already exists and is exact/repository-bound across multiple frozen evaluations, including:

- `docs/ai-editor/benchmarks/phase2-scene-boundary-baseline-v1.md`;
- `docs/ai-editor/benchmarks/phase4-labeled-recall-at-10-baseline-v1.md`;
- `docs/ai-editor/benchmarks/phase5-hybrid-duplicate-control-evaluation-v1.md`;
- `docs/ai-editor/benchmarks/phase6-frame-source-mapping-golden-v1.md`;
- `docs/ai-editor/benchmarks/phase7-human-acceptance-rate-baseline-v1.md`;
- Phase-8 frozen editorial-quality control and same-fixture planner evaluation.

The existing `packages/contracts/src/ai-model-registry.contract.ts` also already provides pinned model, prompt and execution-profile identities, including decoding-policy and optional scoring-policy versions. Phase 9 must reuse these identities rather than create another model/prompt registry.

### Genuine gaps

The audited standalone package inventory contains no experiment-registry package/contract and no regression-gate package/contract. Therefore these are genuine Phase-9 gaps rather than evidence that can be reconciled from prior phases.

No Phase-9 checklist denominator is present in current standalone authority, so no denominator is invented.

P9-01 is an audit/evidence closure only and does not increase the standalone verified count.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time rules, renderer-neutral v2 adapter boundary, immutable media/revision/render evidence, Style Profile v1, Delivery Profile v1, structured logging, provenance/rights, retrieval/editorial separation and all verified Phase-0 through Phase-8 evidence remain unchanged.

## Next task

P9-02 — implement the smallest additive **versioned experiment-registry contract**. It must bind an experiment revision to an exact versioned benchmark/control, candidate policy/model/prompt/execution-profile evidence and immutable result/evaluation references without duplicating the existing model registry or silently accepting mutable aliases. Regression gating remains a later Phase-9 slice.
