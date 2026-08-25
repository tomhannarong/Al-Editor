# Checkpoint 0044 — Phase 1 shell-free bounded ffprobe execution verified

Date: 2026-08-25 (Asia/Bangkok)

Starting HEAD: `6842565d960fe340309b4f97396da9aca5ab2963`.

## Audit and selected slice

The run re-read `PROJECT_BIBLE.md`, `docs/ai-editor/progress.json`, `docs/ai-editor/PROGRESS.md`, `docs/ai-editor/IMPLEMENTATION_MAPPING.md`, checkpoint 0043, exact `main` HEAD and current CI evidence before modifying code.

Phase 1 already had verified stable content identity, mutable location rebinding, streaming SHA-256 ingest, native ffprobe metadata normalization, PostgreSQL durability, confined local-file ingest and managed immutable-original materialization. Repository search found no existing ffprobe process invocation boundary. Bible section 10 explicitly requires shell-free bounded media processes, so the smallest independent remaining gap was execution confinement around ffprobe rather than new metadata semantics.

## Implementation

Implementation commit `e2bd213a3f8754d7345e0fd733c55497735bd1b7` (`feat: add bounded shell-free ffprobe boundary`) adds:

- `packages/media-catalog/src/ffprobe.ts`
- `packages/media-catalog/src/ffprobe.test.ts`

The boundary:

- launches media processes through `node:child_process.spawn` with `shell: false`;
- passes the media path as an argv value after `-i`, so filenames cannot become shell authority;
- enforces positive safe-integer timeout, stdout and stderr limits;
- kills children that exceed timeout or output caps and fails closed;
- treats non-zero process exits as failure while retaining only already-bounded stderr;
- requires non-empty valid JSON stdout before any metadata normalization side effect;
- hands parsed JSON to the existing `ingestFfprobeStreamMetadata` path rather than creating a second normalizer;
- preserves native integer PTS + rational stream time base as authority; decimal `start_time`/`duration` remain ignored.

Deterministic tests cover literal shell metacharacters remaining inert argv data, stdout overflow, timeout, non-zero exit, fixed ffprobe argv, empty/malformed JSON rejection, native-PTS handoff/persistence and malformed timing failing before stream projection publication.

## Validation

The execution container still cannot resolve `github.com`; no local clone/test pass is claimed. To avoid intermediate broken pushes, both implementation files were assembled into one Git tree and one code commit before moving `main`.

Exactly one normal CI run was used as the final confidence gate:

- AI Editor CI run `32806749817`
- job `97678251159`
- exact implementation SHA `e2bd213a3f8754d7345e0fd733c55497735bd1b7`
- install dependencies: success
- strict TypeScript: success
- Vitest behavioral gate: success
- deterministic migration gate: success
- contract and policy gates: success
- observable status publication: success
- commit status: **`ai-editor-ci/all = success`**

No PostgreSQL/Qdrant local-stack workflow, real FFmpeg/media integration workflow, matrix or rerun was triggered. The slice's required proof is deterministic process-boundary behavior and static/type correctness; codec/media correctness was not changed.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time authority, renderer-neutral adapter boundary, style/delivery/provenance/model contracts, immutable revision/render evidence, PostgreSQL media-catalog persistence and FFmpeg `-copyts` behavior remain unchanged.

Stable asset identity remains SHA-256 byte-derived and separate from storage location. The new execution boundary does not introduce decimal-second authority, executable model output, shell interpolation or a second metadata schema.

## Progress

```text
Standalone verified: 29 / 162 = 17.90%
Phase 0 verified:     22 / 22  = 100.00%
Phase 1 verified:      7 / 14  = 50.00%
```

## Next task

Audit the smallest end-to-end immutable-ingest orchestration gap across the seven verified Phase-1 primitives. Prefer a thin additive coordinator that sequences confined source ingest, managed immutable-original publication and bounded ffprobe normalization using the existing persistence boundary, with deterministic idempotency and fail-closed side-effect-ordering tests. Do not duplicate the verified primitives or add heavyweight runtime CI unless the selected Bible gate explicitly requires it.