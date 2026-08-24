# AI Editor Bible -> Standalone Repository Mapping

`tomhannarong/Al-Editor` is the only active implementation repository and `main` is the active implementation branch. Historical CIOS evidence remains migration provenance; blocked tasks block only direct dependents.

## Architecture mapping

| Bible concept | Standalone target | Migration state | Action |
|---|---|---|---|
| PostgreSQL | `infra/docker-compose.yml` | static pass / runtime pending | Real boot required for P0-03. |
| Qdrant | `infra/docker-compose.yml` | static pass / runtime pending | Real boot required for P0-04. |
| HTTP/AI API | `apps/api` | blocked | Wait for P0-03/P0-04. |
| Review UI | `apps/studio/index.html` | verified | Projection/human-review boundary only. |
| Database migrations | `db/migrations/` + `scripts/migrations/` | verified | Deterministic hash/drift framework. |
| Canonical timeline | `packages/contracts/src/canonical-timeline.contract.ts` | verified | V1 readable; v2 integer frames/rational FPS + native PTS/time base. |
| Media-time authority | `packages/media-time/src/index.ts` | verified | BigInt direct absolute conversions + explicit rounding/golden rates. |
| Renderer boundary | `packages/contracts/src/renderer-adapter.contract.ts` + ADR-012 | verified | Renderer never owns canonical timing. |
| Preview renderer | FFmpeg v2 adapter | eligible after P0-10; retained for walking skeleton | Bind through canonical v2 + shared media-time. |
| Provenance/rights | `packages/contracts` | verified | Fail-closed publication semantics. |

## Critical timeline invariant

Canonical project placement uses integer frames plus rational FPS. Native source selection uses integer PTS plus rational stream time base. Decimal seconds are derived presentation-only values.

## Current migration sequence

```text
P0-03/P0-04     STATIC PASS / RUNTIME PENDING
P0-05           BLOCKED BY P0-03/P0-04
P0-06..P0-10    VERIFIED (independent slices)
P0-11           NEXT INDEPENDENT ITEM
```
