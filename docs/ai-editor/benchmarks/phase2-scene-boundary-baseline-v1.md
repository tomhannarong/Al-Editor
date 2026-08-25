# Phase 2 Scene-Boundary Quality Baseline v1

This benchmark is the deterministic quality baseline required by the Phase-2 advancement gate. It measures scene-boundary detection only; it does not claim editorial/retrieval quality.

- Benchmark ID: `phase2-scene-boundary-baseline`
- Benchmark version: `1.0.0`
- Source time authority: native integer PTS + rational stream time base only
- Fixture time base: `1/90000`
- Boundary tolerance: `1500` PTS
- Labeled boundaries: `90000, 180000, 270000, 360000`
- Baseline detector output boundaries: `90000, 181000, 270000, 450000`
- Deterministic result: precision `0.75`, recall `0.75`, F1 `0.75` (3/4 labeled boundaries matched; 3/4 detected boundaries matched)

The executable definition and exact fixture live in `packages/scene-library/src/quality-baseline.ts` and `quality-baseline.test.ts`. This is a baseline measurement, not an acceptance threshold. Future scene-detection upgrades must compare against the same versioned benchmark or explicitly version the benchmark before claiming a quality gain.
