# ADR-012 — Renderer-neutral canonical adapter boundary

**Status:** Accepted  
**Date:** 2026-08-24

## Decision

The immutable canonical timeline remains the sole editorial timing authority. Renderers are adapters that consume a versioned timeline revision and produce a versioned render plan/artifact identity.

Phase 0 keeps FFmpeg as the first preview/final adapter. Remotion is optional and must prove semantic parity before production use. OTIO is an interchange adapter targeted for Phase 10. None of these adapters may become canonical timeline authority.

Every adapter request must preserve revision identity and manifest digest, use only confined/resolved source paths, and bind output to an explicit delivery-profile version. Render-plan identity is separately hashed. Final media compliance/measurement remains an FFmpeg/FFprobe responsibility even when another renderer produces a preview.

## Prohibited behavior

A renderer must not mutate the timeline, invent frame/PTS timing, silently reinterpret color/audio/delivery policy, bypass source path confinement, or overwrite an immutable artifact identity.

## Dependency rule

This ADR establishes the renderer-neutral boundary independently of the concrete timeline-v2/media-time implementation. Native frame/PTS mapping is migrated later under P0-09/P0-10 and adapters must consume those canonical utilities rather than duplicate them.
