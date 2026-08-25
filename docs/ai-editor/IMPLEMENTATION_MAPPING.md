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
| Versioned scene-set source mapping | `packages/contracts/src/scene-set.contract.ts` | verified on `8759bc04`, CI run `32840639465`, job `97779125483`; immutable asset/stream identity + native integer PTS/rational time base, ordered non-overlapping scenes, no derivative authority |

## Phase 1 closure

The explicit Phase-1 proof is complete:

1. **Idempotent content-addressed assets** — SHA-256 byte identity is stable across moves/re-ingest and independent of mutable locations.
2. **Immutable originals** — local paths are confined, managed copies are content-addressed and byte-verified, and every successful reuse restores the read-only guard.
3. **Normalized stream metadata** — strict ffprobe normalization keeps native integer PTS plus rational stream time base as authority; decimal seconds are derived/non-authoritative.
4. **Durability** — PostgreSQL commits validated asset/location/stream state atomically and rolls back injected late failures.
5. **Real-media composition** — a real FFmpeg fixture flows through managed-original storage, the real bounded ffprobe executable and atomic PostgreSQL persistence, with idempotent re-ingest verified.

## Phase 2 start

P2-01 establishes the dependency boundary for the scene library before any proxy or keyframe generation. A scene-set revision has explicit schema/revision/detector versioning and maps every scene interval to one immutable SHA-256 asset + stream identity/index using native integer PTS and a rational source time base. Decimal seconds/milliseconds, proxy paths and keyframe paths are deliberately absent from source-mapping authority.

The next Phase-2 slice should add immutable revision persistence/idempotency semantics rather than derivative generation. Reusing a `revisionId` with different source mapping or scene intervals must fail closed; exact equivalent re-registration may be idempotent.

Canonical timing remains integer project frames + rational FPS and native PTS + rational stream time base. Existing canonical timeline v1/v2 compatibility, renderer-neutral boundary, style/delivery/provenance/model contracts, structured logging, immutable revision/render evidence and FFmpeg `-copyts` behavior are unchanged.

Phase 0 is complete: 22/22. Phase 1 is complete: 14/14. Phase 2 is now 1/11 verified from the migrated checklist count.
