# AI Editor

Local-first AI editorial decision system for turning real footage plus finished voiceover into a reviewable, editable, reproducible short-form timeline.

Implementation authority: [PROJECT_BIBLE.md](./PROJECT_BIBLE.md)

## Repository policy

- `main` is the active implementation branch.
- AI Editor work is committed directly to `main`; pull requests are not required for this project.
- Progress is evidence-based. A checklist item is `verified` only after its required code/test/CI evidence exists on this repository.
- Original media remains immutable; generated/proxy/render media must not be committed accidentally.

## Migration baseline

This standalone repository replaces the former AI Editor implementation location inside `tomhannarong/creator-intelligence-os`. Historical CIOS evidence is retained as migration provenance, but new verification must bind to `tomhannarong/Al-Editor` `main`.
