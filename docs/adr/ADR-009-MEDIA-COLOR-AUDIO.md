# ADR-009 — Media Color and Audio Policies Are Versioned Delivery Configuration

- **Status:** Accepted
- **Date:** 2026-08-24
- **Owners:** AI Editor architecture

## Context

Hardcoded assumptions about Rec.709, HDR/log interpretation, loudness, captions or audio codecs can silently damage creator footage and make preview, final render and NLE behavior inconsistent.

## Decision

- Preserve source technical metadata.
- Never destructively normalize originals.
- Proxy/display transforms are explicit and versioned.
- Final color, audio and caption requirements live in a versioned `DELIVERY_PROFILE`.
- A renderer is not required to decode every camera original directly; a versioned high-quality render mezzanine may be generated with exact source mapping.
- Canonical editorial source ranges always remain in original/native PTS.
- Professional NLE export references originals for grading and finishing.
- Unknown HDR/log/color interpretation must surface explicitly rather than silently pretending Rec.709.

## Alternatives considered

1. Hardcode SDR/Rec.709 and common audio defaults — rejected because this can silently corrupt or misrepresent source intent.
2. Put delivery choices directly into renderer code — rejected because policy must remain versioned and renderer-neutral.

## Consequences

### Positive

- Renderer behavior is policy-driven.
- Delivery requirements can evolve without rewriting editorial state.
- Preview/final/NLE paths share explicit media policy.

### Negative / trade-offs

- Source inspection and delivery validation are mandatory.
- Unknown color/audio states require warnings or blocked output rather than convenient guesses.

## Migration / rollout

Existing source metadata remains unchanged. New delivery behavior references explicit versioned delivery-profile records/contracts. Render adapters consume policy but do not own it.

## Validation

Media fixtures must include SDR, explicit unknown HDR/log behavior, audio mapping/loudness rules and caption-safe-area checks where applicable.

## Reversal plan

Delivery policy may be superseded by a newer profile/schema version; accepted timeline/source evidence remains immutable.
