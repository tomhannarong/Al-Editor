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
| Stable media asset identity | `packages/contracts/src/media-catalog.contract.ts` | verified on `c68362f`, CI run `32772298608` |
| Mutable media storage location boundary | media-catalog contract + `packages/media-catalog/src/index.ts` | verified; rebinding does not change byte-derived identity |
| Streaming content-addressed ingest | `packages/media-catalog/src/index.ts` | verified on repaired exact head `b820fc8`, CI run `32776732634` |
| Idempotent asset registration | `InMemoryMediaCatalog.registerAsset` + ingest tests | verified deterministic semantics; first-ingest evidence preserved |
| Normalized native stream metadata contract | `packages/contracts/src/media-catalog.contract.ts` | verified contract |
| ffprobe native stream normalization/persistence | `packages/media-catalog/src/index.ts` | verified on `705e1dc8`, CI run `32782942297` |
| Durable PostgreSQL media-catalog persistence | migrations + PostgreSQL adapter | next |

The verified ffprobe normalization path uses `time_base`, `start_pts` and `duration_ts` as source timing authority, ignores decimal `start_time`/`duration`, fails closed on malformed/unsafe timing, rejects duplicate stream indexes, and persists projections only for registered immutable assets.

Canonical timing remains integer frames + rational FPS and native PTS + rational stream time base. FFmpeg adapters must preserve source timestamps (`-copyts`) before native-PTS trims. Telemetry is observational only; renderer adapters cannot become timing authority. Final media measurement remains FFmpeg/ffprobe.

Phase 0 is complete: 22/22 standalone items verified. Phase 1 is 3/14 verified. The next smallest durability slice is PostgreSQL-backed catalog persistence behind the already verified interfaces.
