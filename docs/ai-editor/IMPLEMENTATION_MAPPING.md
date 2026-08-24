# AI Editor Bible -> Standalone Repository Mapping

Active repository: `tomhannarong/Al-Editor`, branch `main`. A blocked task blocks only direct dependents.

| Capability | Standalone target | State |
|---|---|---|
| PostgreSQL / Qdrant | `infra/docker-compose.yml` | verified real runtime on `da97e43`, run `32765266590` |
| API health | `apps/api/health-server.mjs` + runtime verifier | verified real dependencies on `7785d92`, run `32766757833` |
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
| Stable media asset identity | `packages/contracts/src/media-catalog.contract.ts` | implemented on `c68362f`; verification pending observable exact-commit gate |
| Mutable media storage location boundary | same media-catalog contract | implemented; location URI is non-identity state |
| Normalized native stream metadata | same media-catalog contract | implemented contract for stream index/kind/native PTS/rational time base; runtime ffprobe ingestion not yet implemented |

Canonical timing remains integer frames + rational FPS and native PTS + rational stream time base. FFmpeg adapters must preserve source timestamps (`-copyts`) before native-PTS trims. Telemetry is observational only; renderer adapters cannot become timing authority. Final media measurement remains FFmpeg/FFprobe.

Phase 0 is complete: 22/22 standalone items verified. Phase 1 has begun additively. The first contract slice separates byte-derived stable identity from mutable storage location and reuses the existing canonical rational/time semantics rather than inventing a second timing authority. The next dependent implementation is streaming content hashing + idempotent asset registration/location rebinding, gated first by exact CI/status evidence for `c68362f`.
