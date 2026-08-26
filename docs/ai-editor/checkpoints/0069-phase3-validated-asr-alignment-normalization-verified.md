# Checkpoint 0069 — Phase 3 validated ASR alignment normalization verified

## Scope

Closed P3-07: audit the remaining Phase-3 gate evidence and add the smallest genuinely missing independent slice — deterministic normalization of untrusted aligned ASR word timing into native source PTS before immutable transcript persistence.

## Starting state

- Starting `main` HEAD: `3b11ec61e936a957154da86f9c9e89bba6d1b3fd`
- Previous verified slice: P3-06 PostgreSQL editorial segment revision persistence/readback
- No failed dependency blocked P3-07.
- Bible Phase-3 gate requires immutable ASR/corrections, stable word timing and editorial segments.

## Audit result

Existing exact evidence already covered:

- immutable transcript/ASR-correction lineage through P3-01;
- immutable and durable transcript revision persistence through P3-02/P3-03;
- versioned immutable/durable editorial segments over stable transcript words through P3-04/P3-06.

The missing boundary was normalization of untrusted ASR/alignment timing into the canonical source-time authority before persistence. Prior contracts could validate native PTS once supplied, but did not prove the provider/alignment adapter conversion itself.

## Implementation

Implementation commit: `17e0eac42a7c2e6270d2c4d1598179f4c325b2c4`

Added:

- `packages/transcript-library/src/asr-alignment.ts`
- `packages/transcript-library/src/asr-alignment.test.ts`
- transcript-library barrel export for the new boundary

Invariants:

- integer microseconds are accepted only as untrusted adapter input;
- source rational time base is normalized before conversion;
- centralized `microsecondsToSourcePts(...)` with explicit `nearest-half-away-from-zero` rounding owns conversion;
- returned transcript stores only native integer `sourceStartPts` / `sourceEndPts` plus rational source time base;
- deterministic word IDs derive from immutable revision identity plus ordinal;
- fractional input, provider overlap/out-of-order timing, invalid confidence and PTS-quantization collapse fail closed;
- no decimal-seconds/millisecond authority is added to the transcript contract or persistence schema.

## Validation

Local validation was attempted first by cloning the exact repository, but the execution environment could not resolve `github.com`. This is recorded as an environment limitation only and is not interpreted as a pass or code failure.

AI Editor CI run `32932548445`, job `98067436909`, on exact implementation SHA:

- dependency install: success
- TypeScript strict: success
- Vitest: success
- deterministic migrations: success
- contract/policy gates: success
- observable status publication: success
- exact `ai-editor-ci/all = success`

No PostgreSQL/Qdrant local-stack, FFmpeg/media integration, matrix or unchanged rerun was used for this deterministic adapter slice.

## Progress

```text
Standalone verified: 54 / 162 = 33.33%
Phase 0:             22 / 22  = 100.00%
Phase 1:             14 / 14  = 100.00%
Phase 2:             11 / 11  = 100.00%
Phase 3:              7 / 9   =  77.78%
```

## Remaining Phase-3 work

The gate audit now has exact evidence for stable word timing normalization and editorial segment lineage. The remaining concrete gap is deterministic construction of an additive correction revision from an immutable parent transcript while preserving source mapping and stable word identity/timing semantics.

## Next task

P3-08: implement a deterministic transcript correction-revision builder. It must bind `parentRevisionId` to the immutable parent, preserve source mapping, reject revision/identity misuse, keep native PTS + rational time base authoritative, and produce a correction revision suitable for the existing immutable/PostgreSQL stores. If that passes, P3-09 should reconcile the Phase-3 gate rather than invent another capability.
