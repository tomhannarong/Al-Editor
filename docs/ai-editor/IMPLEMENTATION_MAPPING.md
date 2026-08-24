# AI Editor Bible -> Standalone Repository Mapping

This document replaces the former Creator Intelligence OS integration mapping. `tomhannarong/Al-Editor` is now the only active implementation repository and `main` is the active implementation branch.

## Migration rule

Historical CIOS evidence remains useful as provenance, but standalone verification requires the corresponding code/contracts/tests to exist here and the relevant gates to pass on an exact `Al-Editor/main` HEAD.

## Architecture mapping

| Bible concept | Standalone target | Migration state | Action |
|---|---|---|---|
| HTTP/AI API | `apps/api` or equivalent standalone service | pending | Migrate only required AI Editor API boundaries; avoid CIOS-only modules. |
| Review UI | `apps/studio` or equivalent standalone UI | pending | Migrate only AI Editor review UX boundaries. |
| PostgreSQL | standalone persistence package + migrations | pending | Preserve durable/immutable state rules. |
| Qdrant | standalone vector retrieval boundary | pending | Preserve collection/payload versioning and local-first operation. |
| Durable jobs | standalone leased/idempotent job authority | pending | Preserve bounded retry, heartbeat and recoverability invariants. |
| Model gateway | provider-neutral model boundary | pending | External model calls remain versioned and governed. |
| Prompt registry | versioned prompt package | pending | No loose production prompt strings. |
| Observability | AI Editor structured log/telemetry contract | pending migration | Migrate Phase-0 structured logging contract. |
| Golden evaluation | standalone fixtures and CI gates | pending migration | Preserve exact timing/render fixtures and later retrieval/editorial benchmarks. |
| Canonical timeline | timeline v1 compatibility + v2 canonical contract | pending migration | Migrate additively; never rewrite historical v1 semantics. |
| Preview renderer | renderer-neutral v2 adapter; FFmpeg first | pending migration | Preserve shell-free execution, path confinement and FFprobe verification. |
| Human revision | immutable timeline revision semantics | pending migration | Preserve parent immutability and distinct render identities. |
| Delivery/style/provenance | standalone versioned contracts | pending migration | Migrate Phase-0 contracts before dependent phases. |

## Critical timeline invariant

Canonical project placement uses integer frames plus rational FPS. Native source selection uses integer PTS plus rational stream time base. Decimal seconds are presentation-only derived fields.

## Renderer boundary

```text
Canonical Timeline v2
   |-- FFmpeg Preview Adapter
   |-- Remotion Composition Adapter (optional, parity-gated)
   |-- OTIO Adapter (Phase 10)
   `-- Final FFmpeg/FFprobe Compliance / Measurement
```

No renderer may become canonical timeline authority, invent timing, bypass source confinement, or silently override color/audio/delivery policy.

## Migration sequence

```text
Bible/progress authority
 -> Phase-0 contracts/testing scaffold
 -> P0-15 provenance/rights
 -> revalidate migrated Phase-0 contract slices
 -> P0-18 ADR mapping
 -> Phase-0 completion gate
 -> Phase 1+
```

The hourly build loop must commit directly to `main`, never create/wait for a PR, and stop on the first failed dependent gate.
