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
| Job state machine | durable job contract | verified |
| Structured logging | privacy-minimized log contract + schema | verified |
| Delivery profile v1 | delivery contract + JSON Schema | verified |
| Provenance/rights | asset provenance v1 | verified |
| Model/prompt/model-artifact registry | versioned registry contract + JSON Schema | verified |
| Cost/performance telemetry | versioned stage telemetry contract | next |
| Concrete FFmpeg v2 adapter | worker adapter | waits canonical render/walking-skeleton dependencies |

Canonical timing remains integer frames + rational FPS and native PTS + rational stream time base. Delivery/style policy cannot become timing authority; FFmpeg/FFprobe remains final media measurement authority. Model/prompt/scoring/deployment identities are pinned references; raw secrets and mutable aliases are not registry authority.
