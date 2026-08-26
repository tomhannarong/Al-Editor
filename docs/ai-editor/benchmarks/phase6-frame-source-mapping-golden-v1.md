# Phase 6 exact frame/source mapping golden v1

This fixture closes the smallest missing cross-layer proof for the Phase-6 `exact frame/source mapping goldens` gate. It does not change the canonical timeline contract or renderer semantics.

## Canonical authorities

- Project frame rate: `30000/1001` frames/second.
- Project interval: frames `[0, 90)`.
- Source stream time base: `1/30000` second per PTS tick.
- Source interval: PTS `[29010, 119100)`.
- Source origin is intentionally non-zero.
- Playback rate: `1/1`.

## Exact golden

- Project span: `90` frames.
- Native source span: `119100 - 29010 = 90090` PTS ticks.
- `90 * 1001/30000` seconds = `3.003` seconds.
- `90090 * 1/30000` seconds = `3.003` seconds.
- `frameToSourcePts(90, 30000/1001, 1/30000)` = `90090`.
- `sourcePtsToFrame(90090, 1/30000, 30000/1001)` = `90`.

The renderer-neutral preview adapter must consume the same absolute native boundaries as `trim=start_pts=29010:end_pts=119100`, preserve `-copyts`, render at `30000/1001`, and cap output at `90` project frames.

This is a deterministic mapping golden, not a bit-exact encoded-byte guarantee. Integer project frames + rational FPS and native source PTS + rational stream time base remain the only canonical timing authorities.
