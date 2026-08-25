# AI Local Footage Editor — Progress

**Repository:** `tomhannarong/Al-Editor` / `main`  
**Phase:** 2 — Scene Library, Proxies, Keyframes  
**Current task:** audit the smallest durable scene-set revision persistence slice before proxy/keyframe generation

```text
Standalone verified: 38 / 162 = 23.46%
Phase 0:             22 / 22  = 100.00% COMPLETE
Phase 1:             14 / 14  = 100.00% COMPLETE
Phase 2:              2 / 11  =  18.18% verified
```

Phase 0 remains verified: P0-01 through P0-22. Phase 1 remains verified-complete: P1-01 through P1-14.

## Phase 2 verified slices

### P2-01 — versioned scene-set identity and exact source-mapping contract

Implementation commit `8759bc0437d672f4e63329fcc19b84172b9e433d` adds `packages/contracts/src/scene-set.contract.ts` and deterministic tests. Each scene-set revision has explicit schema/revision/detector versioning and binds to one immutable SHA-256 asset + stream identity/index using native safe-integer PTS and a rational source time base. Decimal seconds/milliseconds and derivative paths are absent from source-mapping authority.

Exact evidence: AI Editor CI run `32840639465`, job `97779125483`, `ai-editor-ci/all = success`.

### P2-02 — immutable scene-set revision persistence and idempotency

Implementation commit `c877b5e91f190ba490a1b6767759b4ff69268e02` adds:

- `packages/scene-library/src/index.ts`
- `packages/scene-library/src/index.test.ts`

`InMemorySceneSetRevisionStore` validates a revision before persistence, canonicalizes the rational source time base, stores defensive copies and treats exact semantic re-registration of a `revisionId` as idempotent. Reusing the same `revisionId` with changed scene-set identity, source mapping, detector version, creation evidence or scene intervals fails closed. A new `revisionId` for the same `sceneSetId` is additive and cannot mutate prior evidence.

The first final-gate run `32845448729`, job `97793963767`, passed strict TypeScript but failed one newly added Vitest assertion because the test used `toBeInstanceOf` on the callback rather than asserting the thrown error. Migration and contract gates were skipped after that unit-test failure, and the unchanged run was not rerun.

Repair commit `e221be705e2dbd69e14df5dbbca7b5b949f17c29` changes only that incorrect assertion to `toThrow(SceneSetPersistenceInvariantError)`. Exact repaired evidence: **AI Editor CI run `32845521695`, job `97794189378`, `ai-editor-ci/all = success`**. Install, strict TypeScript, all Vitest tests, deterministic migrations, contract/policy gates and observable status publication passed.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time authority, renderer-neutral v2 adapter boundary, style profile, delivery profile, structured logging, provenance/rights, immutable revision/render evidence, stable content-addressed media identity, PostgreSQL ingest durability and FFmpeg `-copyts` behavior remain unchanged.

Scene-set persistence reuses the P2-01 native PTS + rational time-base authority. Equivalent rational time bases normalize for idempotency without conversion to decimal time. Proxy and keyframe generation remain downstream and blocked from becoming source authority.

## Validation / free-tier discipline

The execution container still cannot resolve `github.com`, so no local clone/test pass is claimed. The implementation was batched into one substantive commit. One real unit-test failure was diagnosed from the exact CI logs and repaired with a code/test reason; the failed run was not rerun unchanged. The repaired commit received one fresh normal CI run. No PostgreSQL/Qdrant local-stack, FFmpeg real-media workflow, matrix or heavyweight derivative workflow was triggered for this deterministic in-memory persistence slice.

## Next task

Audit the smallest **durable scene-set revision persistence** gap. Prefer an additive PostgreSQL migration/adapter that preserves the same immutable `revisionId` conflict semantics and native source mapping established by P2-01/P2-02. Do not start proxy/keyframe generation until durable scene-set evidence can be read back without changing timing authority.
