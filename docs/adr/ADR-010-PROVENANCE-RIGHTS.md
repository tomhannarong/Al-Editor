# ADR-010 — Asset Provenance and Rights Are First-Class Domain Data

- **Status:** Accepted
- **Date:** 2026-08-24
- **Owners:** AI Editor architecture

## Context

Creator systems accumulate original footage, music, fonts, stock, AI-generated assets and third-party media. Publication risk cannot be reconstructed reliably from filenames or storage paths later.

## Decision

- Store provenance, rights basis, license/permission evidence, consent, attribution requirements and publication readiness as explicit versioned domain data.
- Keep rights/provenance separate from mutable storage location and technical media metadata.
- Unknown or unreviewed rights may be stored, but a `cleared` publication claim fails closed unless the rights basis is known, durable review exists, and commercial plus derivative-use allowance are explicit.
- Licensed/permission assets require durable license evidence when applicable.
- Required attribution must carry publication-ready attribution text.
- Obtained/restricted consent requires durable evidence.
- Review code/model-weight/provider licenses separately from media-asset rights.

## Alternatives considered

1. Infer rights from filenames/folders — rejected because it is not durable or auditable.
2. Store a single free-form notes field — rejected because export/pre-publish validation requires structured policy.

## Consequences

### Positive

- Publication validation can fail closed.
- Commercial workflows can grow without a data-model rewrite.
- Rights decisions remain inspectable and auditable.

### Negative / trade-offs

- Ingest and review flows must collect more structured data.
- Unknown rights states may block publication until reviewed.

## Migration / rollout

The Phase-0 `asset-provenance.v1` contract is the initial standalone schema. Future schema evolution is additive/versioned; existing evidence records are not rewritten destructively.

## Validation

Focused contract tests must cover cleared owned assets, unknown/unreviewed states, license evidence, attribution evidence, consent evidence and malformed content identity.

## Reversal plan

A future rights model may supersede v1 through a versioned schema and migration path. Existing provenance evidence remains retained for auditability.
