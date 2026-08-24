# AI Local Footage Editor — Project Bible

**Revision:** 1.2-standalone-ai-editor
**Status:** implementation authority
**Repository:** `tomhannarong/Al-Editor`
**Active branch:** `main`

## 1. Product thesis

This is **not** an AI video generator. AI proposes editorial decisions. Deterministic services own persistence, rendering, revisioning and export.

```text
REAL FOOTAGE
  -> immutable ingest / analysis derivatives
  -> scene understanding / indexing
VOICEOVER
  -> aligned editorial segments
  -> visual intent
  -> candidate retrieval
  -> reranking
  -> editorial planning
  -> immutable canonical timeline revision
  -> human review / replace / trim / lock
  -> deterministic preview / final render / NLE export
  -> feedback + evaluation
```

The north-star metric is **Human Acceptance Rate (HAR)** over reviewed AI decisions. Secondary metrics include Recall@K, nDCG, duplicate occupancy, repeat rate, manual replacements/minute, time-to-first-preview, render success rate and stage-level compute/cost.

## 2. Non-negotiable invariants

1. Original media is immutable.
2. Stable asset identity is separate from mutable storage location.
3. Canonical editorial time uses integer project frames + rational FPS.
4. Source in/out uses native PTS + rational stream time base; milliseconds/decimal seconds are derived presentation fields only.
5. Immutable internal timeline JSON revision is canonical; relational records are projections/indexes and adapters consume the canonical revision.
6. Retrieval relevance and editorial judgment are separate capabilities.
7. Model output, transcript/OCR and media metadata are untrusted data, never executable authority.
8. Human replace/trim/lock decisions are durable feedback/evaluation evidence.
9. No model/prompt/scoring upgrade is accepted without before/after evaluation.
10. Store structured decision signals and scores, not hidden model reasoning.
11. Every model, prompt, embedding, scoring policy, style profile, delivery profile and timeline schema is versioned.
12. Rendering is deterministic at editorial/frame semantics for a pinned toolchain. Bit-exact encoded bytes are a separate optional guarantee.
13. Color/HDR/log, audio/loudness, caption typography/safe-area and delivery requirements are explicit policy, not renderer constants.
14. Asset/model/font/music/voice rights and provenance are inspectable.
15. Expensive AI runs only after deterministic filters/lightweight retrieval where possible.
16. Jobs are idempotent, leased, bounded-retry, observable and recoverable.
17. Durable state and rebuildable derivatives are explicitly distinguished.
18. Cost/performance telemetry starts before optimization.
19. Historical verified evidence from the former CIOS integration may be retained as migration provenance, but new verification must bind to this repository and exact `main` HEAD.
20. Do not duplicate an existing standalone AI Editor capability; adapt/upgrade it behind versioned contracts.

## 3. Repository and delivery rule

- `tomhannarong/Al-Editor` is the only active implementation repository for this project.
- Work is committed directly to `main`.
- Pull requests are not required for AI Editor implementation.
- A checklist item becomes `verified` only with exact code/test/CI evidence on this repository, except historical items explicitly recorded as migrated provenance pending standalone revalidation.

## 4. Target capability architecture

```text
Media Catalog
  -> stream metadata / native PTS
  -> versioned scene sets
  -> proxies / keyframes / render mezzanines
  -> quality + visual metadata revisions
  -> embeddings -> Qdrant

Voiceover
  -> immutable transcript revisions
  -> word alignment
  -> editable voice segments
  -> visual-query generator

Qdrant + metadata filters
  -> baseline retrieval
  -> hybrid/multi-representation retrieval
  -> reranker
  -> Editorial Brain
  -> canonical timeline revision
  -> review UI
  -> feedback/evaluation
  -> FFmpeg/optional Remotion preview and final adapters
  -> OTIO/NLE export
```

## 5. Phase order and gates

Phases advance by evidence, not by elapsed time.

| Phase | Capability | Required proof before advancing |
|---|---|---|
| 0 | Foundation, contracts, reproducibility | canonical v2 time/timeline contract; compatibility plan; CI; walking skeleton |
| 1 | Global media catalog + immutable ingest | idempotent content-addressed assets, normalized stream metadata, native timing |
| 2 | Scene library, proxies, keyframes | versioned scene sets, exact source mapping, quality baseline |
| 3 | Voice/transcript alignment | immutable ASR/corrections, stable word timing, editorial segments |
| 4 | Baseline scene retrieval | query schema, indexed scenes, labeled Recall@10 baseline |
| 5 | Hybrid retrieval + reranking | measurable quality gain on same benchmark, duplicate control |
| 6 | Canonical timeline + deterministic render | exact frame/source mapping goldens, preview/final delivery validation |
| 7 | Human review | replace/trim/lock/revision semantics and first valid HAR measurement |
| 8 | Editorial Brain + style profiles | pacing/continuity/variety improvements and lower repeat rate |
| 9 | Evaluation + preference learning | versioned benchmark, experiment registry, regression gate |
| 10 | OTIO / DaVinci interchange | tested exact target NLE fixture and relink path |
| 11 | Advanced temporal video intelligence | benchmark win + measured cost vs lightweight baseline |
| 12 | Content agent | orchestrates existing APIs only; no hidden parallel workflow |
| 13 | Production scale/hardening | recovery, restore drill, quotas, cost/SLO evidence |
| 14 | Optional distribution/outcome learning | exact render->publication lineage; correlation not confused with causation |

Phase 0–9 are the core product. Phase 10–14 must not delay proof of editorial value.

## 6. Phase 0 implementation order

1. Persist this Bible, implementation mapping and machine-readable progress authority in-repo.
2. Audit every Bible checklist item; mark `verified` only with code/test/CI evidence.
3. Freeze compatibility rules for rough-cut timeline v1.
4. Add canonical timeline v2 contract: rational project frame rate + native source PTS/time base.
5. Add centralized media-time conversions with explicit rounding policy and golden fixtures for 24/25/30/50/60, 24000/1001, 30000/1001, 60000/1001, non-zero PTS and VFR mapping.
6. Define delivery/style/provenance/model registry compatibility.
7. Add timeline v1 -> v2 upcast/read compatibility and prove old immutable evidence remains readable.
8. Define renderer-neutral adapter boundary. Do not make Remotion canonical and do not remove FFmpeg compliance checks.
9. Prove a 3–5 second walking skeleton from canonical timeline v2 -> preview, then edit -> immutable revision -> rerender.
10. Run repository quality gates and record exact HEAD evidence. Failed/unavailable gates remain blockers and are never silently checked off.

## 7. Canonical timeline v2 minimum contract

A timeline revision must at minimum carry:

```text
schemaVersion
revisionId
project/workspace lineage
frameRate = { numerator, denominator }
durationFrames
tracks/items
source asset stable identity
source stream identity
sourceStartPts/sourceEndPts
sourceTimeBase = { numerator, denominator }
deliveryProfileVersion
styleProfileVersion (when planning applies)
provenance/model/scoring revision references where AI decisions are present
immutable manifest/checksum
createdBy/createdAt
```

Derived values such as milliseconds or decimal seconds may be cached for UI/search but must be recomputable from canonical integers/rationals.

## 8. Media correctness gate

Required fixtures include CFR 24/25/30/50/60; 24000/1001, 30000/1001, 60000/1001; at least two VFR phone samples; portrait rotation/display matrix; non-zero start PTS; audio/video with different time bases; Thai captions; SDR plus explicit unknown-HDR/log behavior.

A ten-minute mapping round trip must not accumulate a one-frame drift. Unknown color interpretation must surface a warning rather than silently pretending Rec.709.

## 9. Retrieval/editorial evaluation

Keep retrieval benchmark separate from Editorial Brain benchmark.

Retrieval: Recall@5/10, MRR, nDCG, duplicate occupancy, p95 latency.

Editorial: reviewed HAR, Scene HAR (trim-only retained), repeat rate, shot-type diversity, manual replacements/minute, blind paired A/B where appropriate.

HAR denominator is **reviewed decisions**, with review coverage and publish-without-edit rate reported separately.

## 10. Reliability / security / rights

- Shell-free bounded media processes; path/realpath confinement; symlink/path traversal protection.
- Remote media/provider URLs require SSRF protections and explicit allowlists.
- Secrets are references, never persisted raw in artifacts.
- AI/model output passes strict schema/domain validation before side effects.
- Originals are never auto-deleted without explicit lifecycle authority.
- Derived artifacts are rebuildable and versioned.
- Asset provenance and model-weight/provider terms are separate records.
- Backup/restore ownership, RPO/RTO and DR evidence are required before production claims.

## 11. Progress and checkpoint authority

- `docs/ai-editor/PROGRESS.md` is the human progress view.
- `docs/ai-editor/progress.json` is the machine-readable checkpoint authority.
- `docs/ai-editor/IMPLEMENTATION_MAPPING.md` maps Bible requirements to standalone components and migrated CIOS provenance.
- `docs/ai-editor/checkpoints/` stores immutable run summaries/evidence.

## 12. Hourly continuation rule

Each continuation run must:

1. read this Bible and current progress/checkpoint;
2. inspect the exact `main` HEAD and CI state;
3. determine whether the prior run is complete and validated;
4. if incomplete/failing, do not start a new dependent task—record status only;
5. otherwise execute the next smallest unfinished item in phase order;
6. preserve contracts, immutable evidence, tests and human locks;
7. run relevant gates;
8. update progress and write a checkpoint with exact evidence and next task;
9. commit directly to `main`; do not create or wait for a PR.

Never claim a gate passed when runner/tooling was unavailable.

## 13. Definition of project completion

The project is complete only when the selected Phase 0–14 scope has every checklist item either `verified` or explicitly accepted as `not-applicable/deferred` through an ADR/product decision, all required quality/operational gates pass on the exact release `main` HEAD, and documentation/progress evidence matches the shipped implementation.
