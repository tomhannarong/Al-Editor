# AI Local Footage Editor — Progress

**Repository:** `tomhannarong/Al-Editor` / `main`  
**Phase:** 0 — Foundation, Contracts and Reproducibility  
**Current task:** P0-17 Cost/performance telemetry contract

```text
Standalone: 14 / 162 = 8.64%
Phase 0:    14 / 22  = 63.64%
```

Verified: P0-01, P0-02, P0-06, P0-07, P0-08, P0-09, P0-10, P0-11, P0-12, P0-13, P0-14, P0-15, P0-16, P0-18.

## P0-16 Model / prompt / model-artifact registry — VERIFIED

Added a standalone registry convention that versions prompt identity, model identity, local model artifacts, provider model references, compatibility schema versions and execution profiles. Registry records store hashes/references/evidence rather than raw prompt text, model secrets or hidden reasoning.

Local model artifacts require content SHA-256 plus versioned source-provenance and rights/terms evidence. Provider models require a pinned provider model reference plus versioned terms evidence; credentials are references only and raw secret-looking values are rejected. Mutable aliases such as `latest`, `main`, `stable`, `default` and `current` are rejected for version authorities.

Local evidence before implementation commit `d88a9a7a032742378bbe7d1c31c44d7e0cea74e1`:

```text
strict TypeScript compile: PASS
PASS: model/prompt/artifact registry self-test succeeded (9 behavioral cases)
PASS: model registry JSON Schema authority markers verified
```

P0-03/P0-04 remain runtime-pending and P0-05 remains directly blocked. No CI result is claimed for P0-16; repository-wide CI authority remains P0-20 and no manual Actions rerun was requested.

Next: P0-17 Cost/performance telemetry contract.
