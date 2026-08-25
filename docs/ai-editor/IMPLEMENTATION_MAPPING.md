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
| Stable media asset identity | `packages/contracts/src/media-catalog.contract.ts` | verified on `c68362f`, CI `32772298608` |
| Streaming content-addressed ingest | `packages/media-catalog/src/index.ts` | verified on repaired `b820fc8`, CI `32776732634` |
| Native ffprobe normalization | `packages/media-catalog/src/index.ts` | verified on `705e1dc8`, CI `32782942297` |
| PostgreSQL media catalog | migration 0002 + `packages/media-catalog/src/postgres.ts` | verified real round-trip run `32793644151`, job `97640306272` |
| Confined local-file ingest | `packages/media-catalog/src/local-file-ingest.ts` | verified CI `32799561623`, job `97657612381` |
| Managed immutable original | `packages/media-catalog/src/managed-original.ts` | verified repaired CI `32803814061`, job `97669865113` |
| Shell-free bounded ffprobe | `packages/media-catalog/src/ffprobe.ts` | verified CI `32806749817`, job `97678251159` |
| Immutable local ingest coordinator | `packages/media-catalog/src/immutable-ingest.ts` | verified repaired CI `32809327532`, job `97685529112` |
| Validated-before-durable boundary | `packages/media-catalog/src/durable-ingest.ts` | verified CI `32810880801`, job `97689838481` |
| PostgreSQL atomic validated ingest | `packages/media-catalog/src/postgres.ts` + runtime verifier | verified CI `32815455806`; real runtime `32815455771`, job `97702665269` |
| Durable filesystem -> PostgreSQL composition | `infra/verify-postgres-durable-ingest-runtime.mts` | verified real runtime `32819714185`, job `97715097100` |
| Managed-original read-only reuse guard | `managed-original.ts` + deterministic test | verified CI `32824631728`, job `97729857134` |
| Real ffprobe durable ingest | real FFmpeg fixture + default ffprobe + PostgreSQL verifier | verified repaired runtime `32829569480`, job `97744989990` |
| Phase-1 gate reconciliation | Bible Phase-1 proof mapped to P1-01..P1-13 evidence | verified on docs closure `54223a0d`; no redundant Actions run required |
| Versioned scene-set source mapping | `packages/contracts/src/scene-set.contract.ts` | verified on `8759bc04`, CI `32840639465`, job `97779125483` |
| Immutable scene-set revision persistence | `packages/scene-library/src/index.ts` | verified on repaired `e221be70`, CI `32845521695`, job `97794189378` |
| PostgreSQL scene-set revision persistence | migration 0003 + `packages/scene-library/src/postgres.ts` | verified static CI `32852840324`, job `97817616436`; real PostgreSQL repaired runtime `32853149558`, job `97818643421`, exact `ai-editor-local-stack/all = success` |

## Phase 1 closure

The explicit Phase-1 proof remains complete: content-addressed identities are idempotent, originals are immutable/confined, ffprobe normalization preserves native PTS/rational time base, PostgreSQL durability is atomic, and real-media composition is verified.

## Phase 2 progress

P2-01 establishes versioned scene-set identity and exact source mapping to one immutable asset/stream using native PTS + rational time base.

P2-02 establishes immutable scene-set revision semantics: exact semantic re-registration is idempotent, conflicting `revisionId` reuse fails closed, and new revisions are additive.

P2-03 makes that evidence durable. Migration `0003_create_scene_library.sql` adds immutable scene-set revision rows plus ordered interval rows and references the existing media stream `(asset_id, stream_id, stream_index)` tuple. `PostgresSceneSetRevisionStore` validates before transaction side effects, normalizes rational time bases exactly, commits new revisions and intervals transactionally, and reads native PTS/rational mapping back without decimal-time authority.

Implementation `5c91fa9a4acf2ea23b198d3027142109d04cd630` passed normal CI run `32852840324`, job `97817616436`. The first selective runtime `32852840321` failed because the new verifier reapplied migrations that the preceding verifier had already applied. No unchanged rerun was used. Repair `7cf7b857bfef8585897f208f21cbbe50d723a34c` reuses/asserts the migrated schema; local-stack run `32853149558`, job `97818643421`, then passed all real PostgreSQL/Qdrant/media/scene/API checks and published `ai-editor-local-stack/all = success`.

The next Phase-2 slice should define the smallest rebuildable/versioned proxy derivative contract. Proxy/keyframe derivatives must reference immutable scene-set/source evidence and never become canonical timing authority.

Canonical timing remains integer project frames + rational FPS and native PTS + rational stream time base. Existing canonical timeline v1/v2 compatibility, renderer-neutral boundary, style/delivery/provenance/model contracts, structured logging, immutable revision/render evidence and FFmpeg `-copyts` behavior are unchanged.

Phase 0 is complete: 22/22. Phase 1 is complete: 14/14. Phase 2 is now 3/11 verified.
