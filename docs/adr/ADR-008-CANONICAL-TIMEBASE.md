# ADR-008 — Canonical Editorial Time Uses Rational Frames and Native Source PTS

- **Status:** Accepted
- **Date:** 2026-08-24
- **Owners:** AI Editor architecture

## Context

Milliseconds cannot represent all frame boundaries exactly at fractional NTSC rates and are insufficient as the sole canonical representation for VFR source ranges.

## Decision

- Project timeline positions and durations use integer frames at rational `rateNum/rateDen`.
- Source in/out points use native stream PTS plus rational stream time base.
- Speech alignment may use integer microseconds until edit materialization.
- Milliseconds and decimal seconds are derived presentation values only.
- One shared media-time package owns conversion and rounding logic.
- Existing timeline v1 evidence is preserved; migration to canonical v2 is additive through compatibility/upcast boundaries rather than destructive rewrite.

## Alternatives considered

1. Canonical milliseconds everywhere — rejected because fractional frame boundaries and VFR source ranges cannot be represented safely enough.
2. Renderer-native decimal seconds — rejected because renderer syntax must not become editorial authority.

## Consequences

### Positive

- Frame-accurate interchange and rendering.
- Explicit rounding policy.
- Safer VFR and non-zero-PTS handling.
- Renderer-neutral canonical semantics.

### Negative / trade-offs

- Contracts and APIs are more explicit.
- Adapters must perform rational conversions carefully.

## Migration / rollout

Timeline v1 remains readable and immutable. New canonical revisions use v2 integer-frame/native-PTS semantics. Compatibility code must fail closed when authoritative source timing is unavailable.

## Validation

Fractional-rate, native-PTS, non-zero/negative PTS, rounding and long-duration no-drift fixtures must pass before timeline/render claims are accepted.

## Reversal plan

A future representation may supersede this ADR only through a new versioned timeline contract plus compatibility plan. Existing accepted revisions are never rewritten in place.
