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
| PostgreSQL media catalog | migration 0002 + `packages/media-catalog/src/postgres.ts` | verified real round-trip run `32793644151` |
| Confined local-file ingest | `packages/media-catalog/src/local-file-ingest.ts` | verified CI `32799561623` |
| Managed immutable original | `packages/media-catalog/src/managed-original.ts` | verified repaired CI `32803814061` |
| Shell-free bounded ffprobe | `packages/media-catalog/src/ffprobe.ts` | verified CI `32806749817` |
| Immutable local ingest coordinator | `packages/media-catalog/src/immutable-ingest.ts` | verified repaired CI `32809327532` |
| Validated-before-durable boundary | `packages/media-catalog/src/durable-ingest.ts` | verified CI `32810880801` |
| PostgreSQL atomic validated ingest | `packages/media-catalog/src/postgres.ts` + runtime verifier | verified CI `32815455806`; real runtime `32815455771` |
| Durable filesystem -> PostgreSQL composition | `infra/verify-postgres-durable-ingest-runtime.mts` | verified real runtime `32819714185` |
| Managed-original read-only reuse guard | `managed-original.ts` + deterministic test | verified CI `32824631728` |
| Real ffprobe durable ingest | real FFmpeg fixture + default ffprobe + PostgreSQL verifier | verified repaired runtime `32829569480` |
| Phase-1 gate reconciliation | Bible Phase-1 proof mapped to P1-01..P1-13 evidence | verified on docs closure `54223a0d` |
| Versioned scene-set source mapping | `packages/contracts/src/scene-set.contract.ts` | verified CI `32840639465` |
| Immutable scene-set revision persistence | `packages/scene-library/src/index.ts` | verified repaired CI `32845521695` |
| PostgreSQL scene-set revision persistence | migration 0003 + `packages/scene-library/src/postgres.ts` | verified static CI `32852840324`; real PostgreSQL `32853149558` |
| Versioned rebuildable proxy derivative | `packages/contracts/src/proxy-derivative.contract.ts` | verified CI `32857635477`; explicit scene-set lineage/profile/toolchain, rebuildable artifact URI, source identity remains immutable asset/stream + rational time base |
| Immutable proxy derivative revision persistence | `packages/proxy-library/src/index.ts` | verified on `f950775f`, CI `32863422284`, job `97852730546`; semantic re-registration idempotent, conflicting revision reuse fail-closed, rebuilds require additive revision identity |

## Phase 1 closure

Phase 1 remains complete: content-addressed identities are idempotent, originals immutable/confined, ffprobe normalization preserves native PTS/rational time base, PostgreSQL durability is atomic and real-media composition is verified.

## Phase 2 progress

P2-01 through P2-03 establish versioned scene-set identity, immutable revision semantics and real PostgreSQL durability with exact native source mapping.

P2-04 establishes the rebuildable proxy derivative contract. P2-05 establishes immutable proxy revision persistence semantics before durable storage/generation: exact semantic reuse is idempotent; conflicting `revisionId` evidence fails closed; equivalent rational time bases normalize exactly; historical revision evidence is defensively copied; and changed rebuild state creates a new revision rather than mutating history.

Implementation `f950775fadea9b3681c4c7fdec93cb27b59f29f8` passed AI Editor CI run `32863422284`, job `97852730546`, with `ai-editor-ci/all = success`. No local-stack or real FFmpeg gate was required because P2-05 changes deterministic metadata behavior only.

The next Phase-2 slice should define durable PostgreSQL proxy derivative revision persistence/readback before invoking real FFmpeg proxy generation.

Canonical timing remains integer project frames + rational FPS and native PTS + rational stream time base. Existing canonical timeline v1/v2 compatibility, renderer-neutral boundary, style/delivery/provenance/model contracts, structured logging, immutable revision/render evidence and FFmpeg `-copyts` behavior are unchanged.

Phase 0 is complete: 22/22. Phase 1 is complete: 14/14. Phase 2 is now 5/11 verified.
