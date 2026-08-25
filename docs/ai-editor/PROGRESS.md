# AI Local Footage Editor — Progress

**Repository:** `tomhannarong/Al-Editor` / `main`  
**Phase:** 2 — Scene Library, Proxies, Keyframes  
**Current task:** audit the smallest keyframe derivative contract/generation slice after verified proxy generation

```text
Standalone verified: 43 / 162 = 26.54%
Phase 0:             22 / 22  = 100.00% COMPLETE
Phase 1:             14 / 14  = 100.00% COMPLETE
Phase 2:              7 / 11  =  63.64% verified
```

Phase 0 remains verified-complete through P0-22. Phase 1 remains verified-complete through P1-14.

## Phase 2 verified slices

P2-01 through P2-06 remain verified with their existing exact evidence: versioned scene-set source mapping, immutable scene-set revision semantics, PostgreSQL scene-set durability, rebuildable proxy contract, immutable proxy revision semantics and PostgreSQL proxy durability.

### P2-07 — confined shell-free bounded real FFmpeg proxy generation
Implementation `92c0136a0a820caaa77431f76a0da09433be8547`, test repair `417d3e73abf8516a7da75083eb5246754e691ceb`, runtime hardening `c2ac01b5676c9bd64a070819d5dc29e7c406fc2c`.

`packages/proxy-library/src/generator.ts` executes FFmpeg through the existing bounded `runBoundedProcess` boundary (`shell:false`), reads the managed-original path, confines output beneath a derivative root, requires exact `artifactUri` agreement, maps only the declared source stream and emits the pinned `proxy-h264-720p-v1` derivative. Proxy codec/presentation timestamps remain rebuildable derivative state and never replace native PTS + rational time-base authority.

Exact final evidence on `c2ac01b5676c9bd64a070819d5dc29e7c406fc2c`:

- AI Editor CI run `32875753663`, job `97893121765`: success
- AI Editor Local Stack Gate run `32875753669`, job `97893122814`: success
- real FFmpeg proxy generation step: success
- PostgreSQL media/scene/proxy persistence runtime step: success
- commit statuses: `ai-editor-ci/all = success`, `ai-editor-local-stack/all = success`

Two earlier failures were not counted as passes and were not rerun unchanged. `92c0136...` failed TypeScript because of the new mock test harness typing and its local-stack run failed in the combined media/proxy verifier step. `417d3e7...` repaired the test harness and passed CI. `c2ac01b...` then simplified the bounded 720p filter/runtime fixture and isolated real proxy verification as its own observable step; both required gates passed on that exact SHA.

## Preserved contracts

Canonical timeline v1/v2 compatibility, centralized media-time authority, renderer-neutral v2 adapter boundary, style/delivery/provenance/model contracts, structured logging, immutable revision/render evidence, Phase-1 media durability and Phase-2 scene/proxy durable lineage remain unchanged.

## Validation / free-tier discipline

No matrix or separate heavyweight workflow was added. Real FFmpeg proof was folded into the existing selective local-stack job. Failed commits were repaired by code/config changes rather than unchanged reruns.

## Next task

Audit the smallest additive Phase-2 keyframe derivative slice tied to immutable scene-set/source authority before durable or real extraction work. Keep any real FFmpeg extraction selective and do not let image filenames or derived timestamps become canonical timing authority.
