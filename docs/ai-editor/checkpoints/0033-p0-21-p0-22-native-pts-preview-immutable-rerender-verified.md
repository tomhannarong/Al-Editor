# Checkpoint 0033 — P0-21/P0-22 native-PTS preview and immutable rerender verified

Date: 2026-08-25 (Asia/Bangkok)

Starting progress HEAD: `263b5b6466944e9f53ed97887e50e0ac290d3001`. Initial preview implementation HEAD: `1c392040a63c00cc31f1a7449054aae86f91a136`. Repair + immutable revision implementation HEAD: `44140975b113c96eea4f7f05c9cdb59243d1b058`.

## Correctness discovery: absolute native PTS requires preserved input timestamps

The first R1 preview from a source-start window appeared correct. During R2 preparation the same adapter was asked to shift the source window by 15 frames while preserving project duration. Without `-copyts`, FFmpeg rebased MP4 input timestamps before the filter graph, so `trim=start_pts/end_pts` no longer referred to the canonical absolute native-PTS domain. R2 produced only 76 frames instead of 90.

An isolated FFmpeg check proved the fix: `-copyts` placed before input arguments preserves the native input timestamp domain. After adding it, both the original and shifted windows render exactly 90 project frames. This is now a renderer correctness invariant, not an optional optimization.

## P0-21 evidence

Adapter: `ffmpeg-canonical-v2-preview-v1`. The command is shell-free, consumes canonical v2 directly, uses `trim=start_pts=...:end_pts=...`, rational `30000/1001` project FPS and a verified realpath-confined source map. Traversal and an escaping symlink are rejected by the fixture.

Local FFmpeg/FFprobe 7.1.5 evidence after repair:

```text
source stream index: 0
source time base:    1/30000
source start PTS:    29010
source end PTS:      119100
output:              320x180 / 90 frames / 30000/1001 / 3.003000 s
output SHA-256:      fc11e46389591aac1d3f38279c7b200a1faf81a677d6ee77a56bd58348cbc325
```

## P0-22 evidence

Added `canonical-v2-source-window-editor-v1`. It clones instead of mutating the parent, requires a new revision ID + manifest SHA-256, links `parentRevisionId`, preserves native-PTS span, validates chronology and recursively freezes the accepted child.

The real R1/R2 fixture shifted source selection by 15 project frames:

```text
R1: revision-walk-1 / PTS 29010..119100 / SHA fc11e46389591aac1d3f38279c7b200a1faf81a677d6ee77a56bd58348cbc325
R2: revision-walk-2 / parent revision-walk-1 / PTS 44025..134115 / SHA 5674e364d69c173621c20badc1fcdf7ec0c6f427c28a6e8e68b7a3d0ea53bee8
```

Both outputs probe as 90 frames, 30000/1001 and 3.003000 seconds. R1 bytes/hash remain unchanged after R2 publication and R2 bytes/hash differ from R1.

## Exact repository gate

Implementation commit `44140975b113c96eea4f7f05c9cdb59243d1b058` passed push-triggered GitHub Actions run `32764586496` with all named normal gates successful: install, strict TypeScript, Vitest behavioral tests, deterministic migrations and all contract/policy gates. Observable context: `ai-editor-ci/all = success`.

Heavy media tests are reproducible as `npm run media:preview:test` and `npm run media:revision:test` but intentionally remain outside normal GitHub Actions validation to minimize free-tier usage.

P0-21 and P0-22 are VERIFIED. Standalone progress becomes `19/162 = 11.73%`; Phase 0 becomes `19/22 = 86.36%`.

Remaining Phase-0 items are only P0-03, P0-04 and their dependent P0-05. Do not begin Phase 1 before real local-stack runtime evidence completes this gate.
