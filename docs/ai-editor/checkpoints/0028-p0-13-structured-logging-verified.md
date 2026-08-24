# Checkpoint 0028 — P0-13 Structured logging convention verified

Date: 2026-08-24 (Asia/Bangkok)

Starting HEAD: `bd31c84f210ca4cca64582ba1c6e474c00fc557b`.

Migrated the versioned structured-log envelope and added a runtime recursive forbidden-field scanner. Logs carry only durable correlation identifiers and version references; raw prompt/transcript/OCR/media path/URL/secrets/tokens/API keys/model hidden reasoning are forbidden canonical fields. Failed outcomes require stable error codes.

Local evidence:

```text
strict TypeScript compile: PASS
PASS: structured logging self-test succeeded (5 behavior/privacy cases)
PASS: structured log JSON Schema authority markers verified
```

P0-13 is VERIFIED. Standalone progress becomes `12/162 = 7.41%`; Phase 0 becomes `12/22 = 54.55%`.

P0-03/P0-04 remain runtime-pending; P0-05 remains their direct dependent. Next independent item: P0-14 Delivery Profile Schema v1.
