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
| Confined local-file ingest boundary | `packages/media-catalog/src/local-file-ingest.ts` | verified on `f9d704b3`, CI run `32799561623`, job `97657612381` |
| Managed content-addressed original storage | `packages/media-catalog/src/managed-original.ts` | verified on repaired head `1e7dbc2`, CI run `32803814061`, job `97669865113` |
| Shell-free bounded ffprobe execution | `packages/media-catalog/src/ffprobe.ts` | verified on `e2bd213a`, CI run `32806749817`, job `97678251159` |
| End-to-end immutable local ingest coordinator | `packages/media-catalog/src/immutable-ingest.ts` | verified on repaired head `9fc35f46`, CI run `32809327532`, job `97685529112` |
| Validated ingest before durable commit boundary | `packages/media-catalog/src/durable-ingest.ts` | verified on `71bd875a`, CI run `32810880801`, job `97689838481` |
| PostgreSQL atomic validated-ingest commit | `packages/media-catalog/src/postgres.ts` + `infra/verify-postgres-media-catalog-runtime.mts` | verified on `f7f90f8e`; CI run `32815455806`, job `97702665656`; real local-stack run `32815455771`, job `97702665269` |
| Durable filesystem-to-PostgreSQL ingest composition | `infra/verify-postgres-durable-ingest-runtime.mts` + selective local-stack workflow | verified on `fea5a180`; real local-stack run `32819714185`, job `97715097100` |
| Managed-original read-only invariant on reuse | `packages/media-catalog/src/managed-original.ts` + `managed-original-readonly.test.ts` | verified on `58432e1f`; CI run `32824631728`, job `97729857134`; every successful verified reuse restores mode `0444` before location publication/return |

PostgreSQL persistence preserves the authority boundary: `asset_id` is SHA-256 byte identity, storage URI is mutable location state, stream replacement is transactional, and only native integer PTS plus rational time-base columns represent source timing. Decimal seconds/milliseconds are absent from the durable schema.

Local-file ingest and managed-original materialization enforce path confinement, stable source snapshots, content-addressed managed paths and byte verification before metadata processing. The ffprobe process boundary remains shell-free and bounded.

P1-08 composes the filesystem/media primitives without creating a second identity or timing implementation. P1-09 ensures no durable callback is possible until all deterministic media validation succeeds. P1-10 provides the atomic PostgreSQL transaction. P1-11 proves those layers together against a real filesystem and real PostgreSQL. P1-12 tightens immutable-original ownership by restoring the read-only guard even when a previously verified content-addressed file has been made writable externally between idempotent ingests.

Canonical timing remains integer frames + rational FPS and native PTS + rational stream time base. FFmpeg adapters must preserve source timestamps (`-copyts`) before native-PTS trims. Telemetry is observational only; renderer adapters cannot become timing authority. Final media measurement remains FFmpeg/ffprobe.

Phase 0 is complete: 22/22 standalone items verified. Phase 1 is now 12/14 verified. The next run should audit the two remaining Phase-1 items, with special attention to whether a selective real-ffprobe-on-managed-original phase-gate proof is still required before Phase 1 closure.
