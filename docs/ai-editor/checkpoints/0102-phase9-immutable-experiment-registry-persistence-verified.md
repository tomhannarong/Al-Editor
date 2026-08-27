# Checkpoint 0102 — Phase-9 immutable experiment-registry persistence verified

## Starting authority

- Starting `main` HEAD: `58d103537d218e97bb4ac57eee2ce1852e92eb72`.
- Bible revision: `1.2-standalone-ai-editor`.
- Starting progress: `86 / 162 = 53.09%`, Phase 9, P9-03.
- Latest prior checkpoint: `0101-phase9-versioned-experiment-registry-contract-verified.md`.
- P9-02 exact CI evidence was successful, so no failed dependent gate blocked P9-03.

## Implementation

Implementation commit: `0890b33caaf3573f3491aa3f344edf966524ab67` — `feat: persist immutable experiment registry revisions`.

Added:

- `packages/experiment-registry-library/src/index.ts`;
- `packages/experiment-registry-library/src/index.test.ts`.

The store validates P9-02 experiment evidence before mutation, uses immutable `revisionId` identity, makes exact semantic re-registration idempotent, returns deep defensive copies, and requires additive new revisions for changed experiment evidence. Conflicting reuse of an existing revision ID fails closed before state changes.

Immutable comparison covers benchmark/control/fixture refs, candidate policy/model/prompt/execution-profile refs, evaluation policy/result/artifact/SHA-256 evidence, and started/completed/created timestamps. Raw model/prompt/benchmark/result payloads are not copied into the registry.

## Correctness evidence

A single normal CI run was used as the final confidence gate:

- AI Editor CI run `33074640900`;
- job `98525532483`;
- dependency install: success;
- TypeScript strict gate: success;
- Vitest behavioral gate: success;
- migration deterministic gate: success;
- contract and policy gates: success;
- observable commit status publication: success;
- exact `ai-editor-ci/all = success` on `0890b33caaf3573f3491aa3f344edf966524ab67`.

No PostgreSQL/Qdrant local-stack, FFmpeg/media integration, matrix or rerun was used because P9-03 adds no runtime dependency.

## Progress

- Standalone verified: `87 / 162 = 53.70%`.
- Phase 9: 2 verified slices; denominator remains unspecified because current standalone authority does not provide one.
- P9-03 is verified.

## Failures / blockers

- No correctness gate failed.
- No unavailable runner was claimed as a pass or code failure.
- Regression gating is still unimplemented and therefore is not claimed.

## Next task

P9-04 — versioned regression-gate contract. Bind the gate to exact benchmark/control and experiment/result revisions with explicit metric direction/tolerance semantics, while reusing existing benchmark/experiment/model evidence instead of duplicating it.
