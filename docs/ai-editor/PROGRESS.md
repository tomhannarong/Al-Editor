# AI Local Footage Editor — Progress

**Repository:** `tomhannarong/Al-Editor` / `main`  
**Phase:** 9 — Evaluation + Preference Learning  
**Current task:** P9-03 — immutable experiment-registry persistence/idempotency

```text
Standalone verified: 86 / 162 = 53.09%
Phase 0:             22 / 22  = 100.00% COMPLETE
Phase 1:             14 / 14  = 100.00% COMPLETE
Phase 2:             11 / 11  = 100.00% COMPLETE + GATE VERIFIED
Phase 3:              9 / 9   = 100.00% COMPLETE + GATE VERIFIED
Phase 4:              6 / 6   = 100.00% COMPLETE + GATE VERIFIED
Phase 5:              7 / 7   = 100.00% COMPLETE + GATE VERIFIED
Phase 6:              4 / 4   = 100.00% COMPLETE + GATE VERIFIED
Phase 7:              6 / 6   = 100.00% COMPLETE + GATE VERIFIED
Phase 8:              6 verified slices; GATE VERIFIED
Phase 9:              1 verified slice; denominator intentionally unspecified pending checklist authority
```

## P9-02 verified — versioned experiment-registry contract

Implementation `00c8d0a97145031d33d9eb94657284e03f019605` adds `packages/contracts/src/experiment-registry.contract.ts`, deterministic tests and the contracts barrel export.

The contract binds each immutable experiment revision to:

- exact benchmark, benchmark revision and control revision, with optional pinned fixture revision;
- exact candidate policy identity/revision;
- exact model ID/version, optional prompt ID/version and execution-profile ID/version, reusing the existing AI model registry identities rather than embedding raw model or prompt artifacts;
- exact evaluation-policy version plus immutable result ID/revision/artifact identity and SHA-256 digest;
- explicit started/completed/created timestamps with chronological validation.

Mutable aliases such as `latest`, `main`, `stable`, `default`, `current` and `head` are rejected for revision/version fields. Raw model artifacts, prompt templates, credentials, benchmark payloads and result payloads are intentionally outside this contract.

Exact final-confidence evidence: AI Editor CI run `33069149168`, job `98506625635`; dependency install, strict TypeScript, Vitest, deterministic migrations, contract/policy gates and observable status publication all succeeded. Exact commit status `ai-editor-ci/all = success` is published for `00c8d0a9...`.

No PostgreSQL/Qdrant local-stack, FFmpeg/media workflow, matrix or unchanged rerun was used because this slice adds no runtime dependency.

## Phase 9 audit retained

P9-01 established that versioned benchmark evidence already exists and that the existing AI model registry must be reused. The genuine remaining Phase-9 gaps are durable experiment registration and regression gating. No Phase-9 denominator is invented.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time rules, renderer-neutral v2 adapter boundary, immutable media/revision/render evidence, Style Profile v1, Delivery Profile v1, structured logging, provenance/rights, retrieval/editorial separation and all verified Phase-0 through Phase-8 evidence remain unchanged.

## Next task

P9-03 — implement immutable experiment-registry persistence/idempotency. Exact semantic re-registration of a revision must be idempotent; reusing a `revisionId` with different benchmark/control, candidate registry identities, evaluation/result evidence or timestamps must fail closed before mutation. Regression gating remains a subsequent independent Phase-9 slice.
