# AI Editor Bible -> Standalone Repository Mapping

`tomhannarong/Al-Editor` is the only active implementation repository and `main` is the active implementation branch.

## Migration rule

Historical CIOS evidence remains migration provenance. Standalone verification uses evidence appropriate to each checklist item on `Al-Editor/main`; repository-wide CI is owned by P0-20 and is not redundantly required for every contract/document item. A blocked task blocks only its direct dependents; independent Phase-0 work continues.

## Architecture mapping

| Bible concept | Standalone target | Migration state | Action |
|---|---|---|---|
| Repository/Bible authority | root + `docs/ai-editor/` | verified | Keep machine/human progress synchronized. |
| PostgreSQL | `infra/docker-compose.yml` + future persistence/migrations | static config implemented; runtime pending | Boot and health-check before P0-03 verification. |
| Qdrant | `infra/docker-compose.yml` + future retrieval boundary | static config implemented; runtime pending | Boot and health-check before P0-04 verification. |
| HTTP/AI API | `apps/api` or equivalent standalone service | blocked by local service runtime gate | Add only after P0-03/P0-04 runtime proof. |
| Review UI | `apps/studio/index.html` + static verifier | verified | Keep review UI a projection/human-decision boundary, never canonical authority. |
| Durable jobs | standalone leased/idempotent job authority | pending | Preserve bounded retry, heartbeat and recoverability invariants. |
| Model gateway | provider-neutral model boundary | pending | External model calls remain versioned and governed. |
| Prompt registry | versioned prompt package | pending | No loose production prompt strings. |
| Observability | AI Editor structured log/telemetry contract | pending migration | Migrate Phase-0 structured logging contract. |
| Golden evaluation | standalone fixtures and release gates | pending migration | Preserve timing/render fixtures and later retrieval/editorial benchmarks. |
| Canonical timeline | timeline v1 compatibility + v2 canonical contract | pending migration | Migrate additively; never rewrite historical v1 semantics. |
| Preview renderer | renderer-neutral v2 adapter; FFmpeg first | pending migration | Preserve shell-free execution, path confinement and FFprobe verification. |
| Human revision | immutable timeline revision semantics | pending migration | Preserve parent immutability and distinct render identities. |
| Provenance/rights | `packages/contracts` asset provenance v1 | verified | Keep fail-closed publication semantics. |
| ADR-008 | `docs/adr/ADR-008-CANONICAL-TIMEBASE.md` | accepted | Rational frames + native source PTS remain canonical. |
| ADR-009 | `docs/adr/ADR-009-MEDIA-COLOR-AUDIO.md` | accepted | Delivery/color/audio/caption policy stays explicit and versioned. |
| ADR-010 | `docs/adr/ADR-010-PROVENANCE-RIGHTS.md` | accepted | Rights/provenance remains first-class data. |
| ADR-011 | `docs/adr/ADR-011-UNTRUSTED-INPUT-BOUNDARY.md` | accepted | Media/model content remains untrusted data. |

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

## Current migration sequence

```text
P0-01/P0-02 repository authority        VERIFIED
P0-15 provenance/rights                 VERIFIED
P0-18 ADR-008..011                      VERIFIED
P0-03/P0-04 local Postgres + Qdrant     STATIC PASS / RUNTIME PENDING
P0-05 API health                        BLOCKED BY P0-03/P0-04
P0-06 Review UI shell                   VERIFIED
P0-07 Renderer-neutral boundary         NEXT INDEPENDENT ITEM
```

The build loop commits directly to `main`, never creates/waits for a PR, blocks only direct dependents, and continues the smallest safe independent Phase-0 item.
