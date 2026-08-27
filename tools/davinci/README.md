# Phase-10 selective DaVinci Resolve OTIO validation

This directory is deliberately outside normal GitHub Actions paths. The Phase-10 Bible gate requires a **tested exact target NLE fixture and verified relink path**, so deterministic TypeScript tests alone must not be presented as real DaVinci proof.

## Preconditions

- DaVinci Resolve is installed and running on a machine with external scripting enabled.
- Resolve's bundled `DaVinciResolveScript` Python module is available on `PYTHONPATH`.
- The `.otio` file was produced by `serializeOtioDavinciTimelineDocumentV1(...)` from an exact canonical timeline v2 revision + verified interchange manifest.
- `--media-root` contains the project-relative relink paths named by the manifest (for example `Media/Originals/clip-001.mov` under that root).
- Use a unique disposable `--project-name`; the capture script refuses to reuse an existing project and never deletes projects or media.

## Capture

```bash
python3 tools/davinci/capture_otio_roundtrip.py \
  --otio /absolute/path/phase10-fixture.otio \
  --media-root /absolute/path/project-root \
  --project-name AIEditor-Phase10-Validation-20260828 \
  --timeline-name AIEditor-Phase10-Fixture \
  --evidence /absolute/path/phase10-resolve-evidence.json \
  --roundtrip /absolute/path/phase10-resolve-roundtrip.otio
```

The script imports the OTIO through Resolve's MediaPool with `importSourceClips` and `sourceClipsPath`, records imported track/item names and start/end/duration, and re-exports OTIO through Resolve scripting. A successful script run is **runtime capture only**; Phase-10 remains open until the captured evidence and re-export are checked against the canonical manifest/source-lineage expectations and committed as exact evidence.
