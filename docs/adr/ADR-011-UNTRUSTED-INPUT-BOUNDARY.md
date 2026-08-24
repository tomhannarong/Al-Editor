# ADR-011 — Media, Metadata, Transcript and Model Output Are Untrusted Data

- **Status:** Accepted
- **Date:** 2026-08-24
- **Owners:** AI Editor architecture

## Context

Media processing and agentic AI introduce parser, path, SSRF, command-injection and prompt-injection risks. Model output and media metadata are data, not authority.

## Decision

- Media, transcript and OCR content can never alter tool/system policy.
- FFmpeg/FFprobe and other media processes run with explicit argument arrays plus bounded resource and path controls; no shell-string execution.
- Local media access follows path/realpath confinement and symlink/traversal protections.
- Remote media/provider access requires explicit allowlists and SSRF protections.
- AI agents call allowlisted domain APIs only.
- Provider/model output is strict-schema and domain validated before persistence or side effects.
- Secrets are references and are never persisted raw in artifacts/logs.
- Logs store structured decision signals, identifiers and stable error codes, not raw hidden model reasoning.

## Alternatives considered

1. Rely on prompting alone for safety — rejected because prompts cannot enforce runtime capability boundaries.
2. Allow free-form shell/media commands from model output — rejected because model text is untrusted input.

## Consequences

### Positive

- Security is enforced outside the model.
- Prompt/media content cannot grant runtime capabilities that are not exposed.
- Media execution is more auditable and deterministic.

### Negative / trade-offs

- Provider integrations and media adapters require explicit validation/confinement code.
- Some convenient dynamic behavior is intentionally disallowed.

## Migration / rollout

All new adapters must conform to this boundary. Existing migrated renderer/media logic is accepted only when shell-free execution and confinement evidence are preserved.

## Validation

Tests must cover schema rejection, path traversal/symlink confinement, provider-output validation and command construction without shell interpolation where relevant.

## Reversal plan

Trust boundaries may only be widened through a superseding ADR with an explicit threat-model update and executable security evidence.
