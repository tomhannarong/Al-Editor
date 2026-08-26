# Checkpoint 0087 — Phase-6 final-delivery validation boundary verified

## Starting authority

- Starting `main` HEAD: `3390c13013bf66fa37f722fd69f4c3a1b8361ec5`.
- Phase 6 had one verified slice, P6-01.
- Bible Phase-6 gate still required `preview/final delivery validation`.
- Starting docs-only HEAD had no Actions run, consistent with path filters.

## Audit result

Existing standalone evidence is sufficient for real preview and immutable rerender:

- checkpoint 0033 records shell-free canonical-v2 FFmpeg preview using absolute native PTS with `-copyts` and FFprobe readback;
- the same checkpoint records immutable R1/R2 rerender output, exact frame count/rate/duration and distinct render hashes;
- checkpoint 0029 verifies the versioned Delivery Profile contract/schema.

The concrete missing boundary was final-output compliance validation. The repository had no deterministic function that could compare measured render evidence against the exact Delivery Profile identity/version.

## P6-02 implementation

Implementation commit: `6d645c87a6079c657e0507fd9e4ff5fe5feed5e8`.

Added `packages/final-delivery-validator/src/index.ts` and deterministic tests. The validator checks:

- exact delivery profile identity/version;
- container, video codec, pixel format and canvas;
- rationally equivalent frame rate via canonical rational normalization;
- color primaries/transfer/matrix/range;
- optional video bitrate ceiling;
- audio codec/sample rate/channels;
- measured integrated loudness and true-peak maximum;
- burned-in/sidecar caption presence, safe area and line-count policy.

Normalized render measurement evidence is explicitly non-canonical; canonical editorial timing remains integer project frames + rational FPS and native source PTS + rational stream time base.

## Validation

One normal CI run was used as final confidence because package code/tests changed:

- AI Editor CI run `33017556928`;
- job `98339605165`;
- dependency install: success;
- TypeScript strict: success;
- Vitest behavioral gate: success;
- deterministic migrations: success;
- contract/policy gates: success;
- observable status publication: success;
- exact `ai-editor-ci/all = success` on `6d645c87a6079c657e0507fd9e4ff5fe5feed5e8`.

No local-stack, PostgreSQL/Qdrant, matrix or heavyweight FFmpeg runtime was used for this deterministic validator slice.

## Progress

Standalone verified becomes `71 / 162 = 43.83%`.

Phase 6 has two verified slices. No Phase-6 denominator is invented without checklist authority.

## Next task

`P6-03-phase6-real-final-delivery-output-runtime-validation`: create the smallest selective real-output verifier that renders a fixture and supplies actual FFprobe/loudness/caption measurement evidence to the P6-02 validator. Keep it manual/selective rather than normal CI unless a later release gate explicitly requires otherwise.
