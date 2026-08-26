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
| Versioned rebuildable proxy derivative | `packages/contracts/src/proxy-derivative.contract.ts` | verified CI `32857635477` |
| Immutable proxy derivative revision persistence | `packages/proxy-library/src/index.ts` | verified CI `32863422284` |
| PostgreSQL proxy derivative revision persistence | migration 0004 + `packages/proxy-library/src/postgres.ts` | verified CI `32869312338`; real PostgreSQL `32869312804` |
| Confined bounded real proxy generation | `packages/proxy-library/src/generator.ts` + `infra/verify-real-proxy-generation-runtime.mts` | verified on `c2ac01b5`; CI `32875753663`; real FFmpeg/local-stack `32875753669` |
| Versioned rebuildable keyframe derivative | `packages/contracts/src/keyframe-derivative.contract.ts` | verified on `59aa02ed`; CI `32881831056` job `97912919380` |
| Immutable keyframe derivative revision persistence | `packages/keyframe-library/src/index.ts` | verified on `5ce040ae`; CI `32886479355` job `97928027272` |
| PostgreSQL keyframe derivative revision persistence | migration 0005 + `packages/keyframe-library/src/postgres.ts` | verified on `bc8431df`; CI `32892664602` job `97947954572`; real PostgreSQL/local-stack `32892664650` job `97947954495` |
| Confined bounded real keyframe extraction | `packages/keyframe-library/src/generator.ts` + `infra/verify-real-keyframe-extraction-runtime.mts` | verified on `57f68a11`; CI `32899647168` job `97970214362`; real FFmpeg/local-stack `32899647404` job `97970215910` |
| Scene-boundary quality baseline | `packages/scene-library/src/quality-baseline.ts` + versioned fixture | verified on `4fca4d89`; CI `32903495078` job `97982328934`; baseline P/R/F1 = 0.75/0.75/0.75 |
| Versioned immutable transcript / ASR-correction lineage | `packages/contracts/src/transcript.contract.ts` | verified on repaired `0921bcd2`; CI `32909410505` job `98000354561` |
| Immutable transcript revision persistence | `packages/transcript-library/src/index.ts` | verified on `92037f27`; CI `32914047941` job `98013856761` |

## Phase 1 closure

Phase 1 remains complete: content-addressed identities are idempotent, originals immutable/confined, ffprobe normalization preserves native PTS/rational time base, PostgreSQL durability is atomic and real-media composition is verified.

## Phase 2 closure

P2-01 through P2-03 establish versioned scene-set identity, immutable revision semantics and real PostgreSQL durability with exact native source mapping.

P2-04 through P2-07 establish rebuildable/versioned proxy evidence, immutable revision semantics, PostgreSQL durability and confined bounded real FFmpeg generation without introducing proxy-time authority.

P2-08 through P2-11 establish versioned keyframe evidence, immutable revision semantics, PostgreSQL durability and confined bounded real FFmpeg extraction with exact scene/source native-PTS lineage.

The Phase-2 `quality baseline` requirement is backed by `packages/scene-library/src/quality-baseline.ts`, deterministic tests and `docs/ai-editor/benchmarks/phase2-scene-boundary-baseline-v1.md`. Exact implementation `4fca4d89dae48d57e381420bea91b6d321efba41` passed AI Editor CI `32903495078` / job `97982328934`.

## Phase 3 status

Phase 3 contains 9 checklist items. P3-01 established versioned immutable transcript/ASR-correction lineage. P3-02 now establishes immutable in-memory revision persistence/idempotency in `packages/transcript-library/src/index.ts`: equivalent rational source time bases normalize for semantic equality; conflicting reuse of a revision identity fails closed; additive correction revisions preserve historical ASR evidence; returned source/word evidence is defensively copied. Exact implementation `92037f27e0a5180e1706fc405d3ff7ecc5e8a148` passed AI Editor CI `32914047941`, job `98013856761`, with `ai-editor-ci/all = success`.

Canonical timing remains integer project frames + rational FPS and native PTS + rational stream time base. Existing canonical timeline v1/v2 compatibility, renderer-neutral boundary, style/delivery/provenance/model contracts, structured logging and immutable revision/render evidence are unchanged.

Phase 0 is complete: 22/22. Phase 1 is complete: 14/14. Phase 2 is complete: 11/11 plus exact gate evidence. Phase 3 is in progress: 2/9.
