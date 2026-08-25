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
| Durable PostgreSQL media-catalog schema | `db/migrations/0002_create_media_catalog.sql` | verified against real PostgreSQL on run `32793644151` |
| PostgreSQL media-catalog adapter | `packages/media-catalog/src/postgres.ts` + runtime verifier | verified real round-trip on `303f0118`, run `32793644151`, job `97640306272` |
| Confined local-file ingest boundary | `packages/media-catalog/src/local-file-ingest.ts` | verified on `f9d704b3`, CI run `32799561623`, job `97657612381`; allowed-root confinement, direct symlink rejection, read-only/no-follow open, bounded streaming hash, stable file snapshot before catalog publish |
| Managed content-addressed original storage | `packages/media-catalog/src/managed-original.ts` | verified on repaired head `1e7dbc2`, CI run `32803814061`, job `97669865113`; SHA-256-derived path, exclusive temp copy, atomic hard-link publication, byte verification before catalog location publish, idempotent verified reuse, corrupted destination fail-closed |

PostgreSQL persistence preserves the authority boundary: `asset_id` is SHA-256 byte identity, storage URI is mutable location state, stream replacement is transactional, and only native integer PTS plus rational time-base columns represent source timing. Decimal seconds/milliseconds are absent from the durable schema.

Local-file ingest adds a security/correctness boundary without changing identity semantics: the resolved path must stay inside an explicit root, direct symlinks fail closed, content is read through a read-only handle, and catalog state is not published if file identity/size/timestamps drift during hashing.

Managed original materialization now closes the immutable-original ownership gap for local ingest. A registered asset can be copied into managed storage at a deterministic SHA-256 path using an exclusive temporary file and create-if-absent hard-link publication. Existing content is reused only after digest/size verification; corrupted content or changed source bytes fail closed before managed location state is published. Successful final content is marked read-only as an additional application-level guard.

Canonical timing remains integer frames + rational FPS and native PTS + rational stream time base. FFmpeg adapters must preserve source timestamps (`-copyts`) before native-PTS trims. Telemetry is observational only; renderer adapters cannot become timing authority. Final media measurement remains FFmpeg/ffprobe.

Phase 0 is complete: 22/22 standalone items verified. Phase 1 is now 6/14 verified. The next run should audit the remaining Phase-1 ingest surface for a shell-free bounded ffprobe execution boundary before adding new metadata semantics.