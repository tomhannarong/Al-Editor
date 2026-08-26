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
| PostgreSQL transcript revision persistence | migration 0006 + `packages/transcript-library/src/postgres.ts` | verified on `e01b9818`; CI `32917035651` job `98022790043`; real PostgreSQL/local-stack `32917035721` job `98022789688` |
| Versioned editorial segment over immutable transcript words | `packages/contracts/src/editorial-segment.contract.ts` | verified on `747e9151`; CI `32920801878` job `98033851515` |
| Immutable editorial segment revision persistence | `packages/editorial-segment-library/src/index.ts` | verified on `90e0d6d8`; CI `32924861455` job `98045600642` |
| PostgreSQL editorial segment revision persistence | migration 0007 + `packages/editorial-segment-library/src/postgres.ts` | verified static CI on `695e5105`, run `32928880002` job `98057124865`; verifier fixture repaired on `f5b8fba3`; real PostgreSQL/local-stack run `32929033073` job `98057560645` success |
| Validated ASR alignment -> native PTS normalization | `packages/transcript-library/src/asr-alignment.ts` | verified on `17e0eac4`; CI `32932548445` job `98067436909`; untrusted integer-microsecond input normalized through centralized media-time authority into native PTS |
| Deterministic transcript correction revision builder | `packages/transcript-library/src/correction-revision.ts` | verified on `02d5c273`; CI `32936036706` job `98077317683`; additive correction preserves immutable source + stable word identity/native timing |
| Phase-3 gate reconciliation | P3-01..P3-08 exact evidence + checkpoint 0071 | verified; immutable ASR/corrections, stable word timing and editorial segments all satisfied without redundant Actions run |

## Phase 1 closure

Phase 1 remains complete: content-addressed identities are idempotent, originals immutable/confined, ffprobe normalization preserves native PTS/rational time base, PostgreSQL durability is atomic and real-media composition is verified.

## Phase 2 closure

P2-01 through P2-03 establish versioned scene-set identity, immutable revision semantics and real PostgreSQL durability with exact native source mapping.

P2-04 through P2-07 establish rebuildable/versioned proxy evidence, immutable revision semantics, PostgreSQL durability and confined bounded real FFmpeg generation without introducing proxy-time authority.

P2-08 through P2-11 establish versioned keyframe evidence, immutable revision semantics, PostgreSQL durability and confined bounded real FFmpeg extraction with exact scene/source native-PTS lineage.

The Phase-2 `quality baseline` requirement is backed by `packages/scene-library/src/quality-baseline.ts`, deterministic tests and `docs/ai-editor/benchmarks/phase2-scene-boundary-baseline-v1.md`. Exact implementation `4fca4d89dae48d57e381420bea91b6d321efba41` passed AI Editor CI `32903495078` / job `97982328934`.

## Phase 3 closure

Phase 3 contains 9 checklist items and is verified-complete.

P3-01 through P3-03 establish versioned immutable transcript/ASR-correction lineage plus in-memory and PostgreSQL durability. P3-04 through P3-06 establish versioned, immutable and durable editorial segments over stable transcript word identities. P3-07 normalizes untrusted aligned ASR timing through the centralized media-time authority into native integer PTS before persistence. P3-08 establishes deterministic additive correction construction from an immutable parent transcript while preserving source mapping, stable word IDs/ordinals and native timing.

P3-09 reconciles these exact proofs against the Bible gate. Immutable ASR/corrections are covered by P3-01/P3-02/P3-03/P3-08; stable word timing is covered by P3-01/P3-07/P3-08; editorial segments are covered by P3-04/P3-05/P3-06. No additional subsystem or redundant Actions run is required to close the phase.

Canonical timing remains integer project frames + rational FPS and native PTS + rational stream time base. Existing canonical timeline v1/v2 compatibility, renderer-neutral boundary, style/delivery/provenance/model contracts, structured logging and immutable revision/render evidence are unchanged.

Phase 0 is complete: 22/22. Phase 1 is complete: 14/14. Phase 2 is complete: 11/11 plus exact gate evidence. Phase 3 is complete: 9/9 plus exact gate reconciliation.

## Phase 4 next

Phase 4 — Baseline Scene Retrieval — now becomes the active phase. The Bible gate requires a query schema, indexed scenes and a labeled Recall@10 baseline. P4-01 should begin by auditing the existing retrieval surface and implementing only the smallest missing versioned query-schema contract tied to exact indexed scene-set/source identity. Hybrid retrieval and reranking remain Phase 5 concerns and must not leak into the baseline.
