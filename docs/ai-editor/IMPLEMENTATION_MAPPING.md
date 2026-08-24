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
| Job state machine | `job-state-machine.contract.ts` | verified |
| Structured logging | `ai-editor-observability.contract.ts` + schema | verified |
| Delivery profile v1 | delivery contract + JSON Schema | verified |
| Provenance/rights | asset provenance v1 | verified |
| Model/prompt/model-artifact registry | versioned registry contract + JSON Schema | verified |
| Cost/performance telemetry | stage telemetry contract + JSON Schema | verified |
| ADR convention | `docs/adr/ADR-TEMPLATE.md` | verified |
| CI quality gate | single-job named-stage workflow + observable status | verified |
| Canonical v2 preview | `packages/preview-renderer` + manual real FFmpeg/FFprobe fixture | verified; `-copyts` preserves absolute native PTS |
| Immutable rerender revision | `packages/timeline-revision` + manual R1/R2 real-media fixture | verified |

Canonical timing remains integer frames + rational FPS and native PTS + rational stream time base. FFmpeg adapters must preserve source timestamps (`-copyts`) before native-PTS trims. Telemetry is observational only; renderer adapters cannot become timing authority. Final media measurement remains FFmpeg/FFprobe.

Phase-0 remaining chain: P0-03 PostgreSQL runtime proof + P0-04 Qdrant runtime proof -> P0-05 API health. Phase 1 remains gated.
