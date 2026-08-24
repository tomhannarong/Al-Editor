# AI Editor Bible -> Standalone Repository Mapping

`tomhannarong/Al-Editor` is the only active implementation repository and `main` is the active implementation branch.

Historical CIOS evidence remains migration provenance. Standalone verification uses evidence appropriate to each checklist item. A blocked task blocks only direct dependents.

## Architecture mapping

| Bible concept | Standalone target | Migration state | Action |
|---|---|---|---|
| PostgreSQL | `infra/docker-compose.yml` | static pass / runtime pending | Real boot required for P0-03. |
| Qdrant | `infra/docker-compose.yml` | static pass / runtime pending | Real boot required for P0-04. |
| HTTP/AI API | `apps/api` | blocked | Wait for P0-03/P0-04. |
| Review UI | `apps/studio/index.html` | verified | Projection/human-review boundary only. |
| Database migrations | `db/migrations/` + `scripts/migrations/` | verified | Deterministic hash/drift framework; runtime apply waits on P0-03. |
| Canonical timeline | `packages/contracts/src/canonical-timeline.contract.ts` | verified | V1 readable; v2 integer frames/rational FPS + native PTS/time base. |
| Media-time authority | standalone package | next | Explicit conversions/rounding + golden fixtures. |
| Renderer boundary | `packages/contracts/src/renderer-adapter.contract.ts` + ADR-012 | verified | Renderer never owns canonical timing. |
| Preview renderer | FFmpeg v2 adapter | waiting P0-10 | Bind only after shared media-time authority. |
| Provenance/rights | `packages/contracts` | verified | Fail-closed publication semantics. |

## Critical timeline invariant

Canonical project placement uses integer frames plus rational FPS. Native source selection uses integer PTS plus rational stream time base. Decimal seconds are derived presentation-only values.

## Current migration sequence

```text
P0-03/P0-04     STATIC PASS / RUNTIME PENDING
P0-05           BLOCKED BY P0-03/P0-04
P0-06           VERIFIED
P0-07           VERIFIED
P0-08           VERIFIED
P0-09           VERIFIED
P0-10           NEXT INDEPENDENT ITEM
```
