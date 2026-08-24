# AI Editor Bible -> Standalone Repository Mapping

Active repository: `tomhannarong/Al-Editor`, branch `main`. A blocked task blocks only direct dependents.

| Capability | Standalone target | State |
|---|---|---|
| PostgreSQL / Qdrant | `infra/docker-compose.yml` | static pass / runtime pending |
| API health | `apps/api` | blocked by P0-03/P0-04 |
| Review UI | `apps/studio` | verified |
| Renderer boundary | typed renderer contract + ADR-012 | verified |
| Migration framework | `db/migrations` + scripts | verified |
| Canonical timeline v1/v2 | canonical timeline contract | verified |
| Media-time authority | `packages/media-time` | verified |
| Style profile v1 | editorial style contract + JSON Schema | verified |
| Job state machine | durable job contract | next |
| Concrete FFmpeg v2 adapter | worker adapter | waits canonical dependencies/revalidation |
| Provenance/rights | asset provenance v1 | verified |

Canonical timing remains integer frames + rational FPS and native PTS + rational stream time base. Style duration milliseconds are non-canonical planner preferences.
