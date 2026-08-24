# AI Editor Bible -> Standalone Repository Mapping

`tomhannarong/Al-Editor` is the only active implementation repository and `main` is the active implementation branch.

## Migration rule

Historical CIOS evidence remains migration provenance. Standalone verification uses evidence appropriate to each checklist item on `Al-Editor/main`; repository-wide CI is owned by P0-20. A blocked task blocks only direct dependents.

## Architecture mapping

| Bible concept | Standalone target | Migration state | Action |
|---|---|---|---|
| Repository/Bible authority | root + `docs/ai-editor/` | verified | Keep progress synchronized. |
| PostgreSQL | `infra/docker-compose.yml` | static pass; runtime pending | Boot/health-check before P0-03. |
| Qdrant | `infra/docker-compose.yml` | static pass; runtime pending | Boot/health-check before P0-04. |
| HTTP/AI API | `apps/api` | blocked by P0-03/P0-04 | Add after runtime proof. |
| Review UI | `apps/studio/index.html` | verified | Projection/human-review boundary only. |
| Migration framework | `db/migrations/` + `scripts/migrations/` | verified | Append-only SQL, deterministic SHA-256 manifest, drift detection; runtime apply waits on PostgreSQL. |
| Canonical timeline | timeline v1 compatibility + v2 | next | Migrate additively; preserve v1. |
| Renderer boundary | `renderer-adapter.contract.ts` + ADR-012 | verified | Timing/path/compliance authority explicit. |
| Preview renderer | FFmpeg v2 adapter | waiting P0-09/P0-10 | Do not duplicate time semantics. |
| Provenance/rights | asset provenance v1 | verified | Fail closed on clearance claims. |

## Current migration sequence

```text
P0-03/P0-04 Postgres + Qdrant        STATIC PASS / RUNTIME PENDING
P0-05 API health                     BLOCKED
P0-06 Review UI                      VERIFIED
P0-07 Renderer boundary              VERIFIED
P0-08 Migration framework            VERIFIED
P0-09 Canonical timeline v2          NEXT
```

The build loop commits directly to `main`, blocks only direct dependents and continues independent Phase-0 items.
