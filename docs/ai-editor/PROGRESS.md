# AI Local Footage Editor — Progress

**Repository:** `tomhannarong/Al-Editor` / `main`  
**Phase:** 0 — Foundation, Contracts and Reproducibility  
**Current task:** obtain real PostgreSQL + Qdrant runtime proof for P0-03/P0-04; P0-05 remains their dependent

```text
Standalone: 19 / 162 = 11.73%
Phase 0:    19 / 22  = 86.36%
```

Verified: P0-01, P0-02, P0-06, P0-07, P0-08, P0-09, P0-10, P0-11, P0-12, P0-13, P0-14, P0-15, P0-16, P0-17, P0-18, P0-19, P0-20, P0-21, P0-22.

## P0-21 Canonical v2 real preview — VERIFIED

The standalone FFmpeg adapter consumes canonical v2 directly: integer project frames + rational FPS and absolute native source PTS/time base. Source paths enter only through a pre-verified path map; the reproducible media fixture rejects traversal and an escaping symlink and launches FFmpeg/FFprobe shell-free via argv arrays.

A correctness regression was found while preparing P0-22: MP4 input timestamps can be rebased by FFmpeg before `trim=start_pts/end_pts`. A shifted absolute-PTS window then produced only 76 frames. The adapter was repaired to place `-copyts` before input arguments, preserving the demuxed native PTS domain. After repair the same source-window semantics produce exactly 90 frames both at stream start and after a 15-frame source shift.

Local real-media evidence after repair:

```text
FFmpeg / FFprobe: 7.1.5
source FPS:        30000/1001
source time base:  1/30000
source start PTS:  29010
source end PTS:    119100
preview:           320x180, 90 frames, 30000/1001, 3.003000 s
preview SHA-256:   fc11e46389591aac1d3f38279c7b200a1faf81a677d6ee77a56bd58348cbc325
traversal:         rejected
escaping symlink:  rejected
shell execution:   none
```

## P0-22 Immutable edit -> rerender — VERIFIED

Added `packages/timeline-revision` with `canonical-v2-source-window-editor-v1`. A child revision must use a new revision ID and manifest SHA-256, link `parentRevisionId`, preserve the authoritative native-PTS span for a source-window shift, use monotonic creation time, leave the parent untouched and become recursively frozen after validation.

Real R1 -> R2 evidence shifts the native source window by 15 frames without changing project duration:

```text
R1 revision:       revision-walk-1
R1 source PTS:     29010 -> 119100
R1 output SHA-256: fc11e46389591aac1d3f38279c7b200a1faf81a677d6ee77a56bd58348cbc325

R2 revision:       revision-walk-2
R2 parent:         revision-walk-1
R2 source PTS:     44025 -> 134115
R2 output SHA-256: 5674e364d69c173621c20badc1fcdf7ec0c6f427c28a6e8e68b7a3d0ea53bee8

R1 after R2:       byte-for-byte unchanged
outputs distinct:  yes
R1/R2 probe:       90 frames, 30000/1001, 3.003000 s
```

The pure adapter/revision tests and all repository gates passed on exact implementation commit `44140975b113c96eea4f7f05c9cdb59243d1b058`, GitHub Actions run `32764586496`, with `ai-editor-ci/all = success`. Heavy FFmpeg tests remain manual/local (`media:preview:test`, `media:revision:test`) and are intentionally excluded from normal CI to preserve free-tier minutes.

## Remaining Phase-0 blockers

Only P0-03, P0-04 and P0-05 remain unverified. P0-03/P0-04 require a real Docker/Compose PostgreSQL + Qdrant boot/readiness proof. P0-05 remains directly blocked until those local services are healthy. Phase 1 must not start before the Phase-0 completion gate.
