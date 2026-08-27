#!/usr/bin/env python3
"""Selective/manual DaVinci Resolve OTIO import/relink/export evidence capture.

Run only against a disposable Resolve project. This script never deletes projects or media.
DaVinci Resolve must already be running with external scripting enabled and its bundled
DaVinciResolveScript module available on PYTHONPATH.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--otio", required=True, type=Path)
    parser.add_argument("--media-root", required=True, type=Path)
    parser.add_argument("--project-name", required=True)
    parser.add_argument("--timeline-name", required=True)
    parser.add_argument("--evidence", required=True, type=Path)
    parser.add_argument("--roundtrip", required=True, type=Path)
    return parser.parse_args()


def require(value: Any, message: str) -> Any:
    if value is None or value is False:
        raise RuntimeError(message)
    return value


def item_evidence(item: Any) -> dict[str, Any]:
    return {
        "name": item.GetName(),
        "start": item.GetStart(),
        "end": item.GetEnd(),
        "duration": item.GetDuration(),
    }


def main() -> int:
    args = parse_args()
    if not args.otio.is_file():
        raise RuntimeError(f"OTIO fixture does not exist: {args.otio}")
    if not args.media_root.is_dir():
        raise RuntimeError(f"media root does not exist: {args.media_root}")
    args.evidence.parent.mkdir(parents=True, exist_ok=True)
    args.roundtrip.parent.mkdir(parents=True, exist_ok=True)

    try:
        import DaVinciResolveScript as dvr_script  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError("DaVinciResolveScript is unavailable; configure Resolve scripting PYTHONPATH first") from exc

    resolve = require(dvr_script.scriptapp("Resolve"), "DaVinci Resolve is not running or scripting is unavailable")
    project_manager = require(resolve.GetProjectManager(), "Resolve project manager is unavailable")
    if project_manager.LoadProject(args.project_name):
        raise RuntimeError(f"Refusing to reuse existing project {args.project_name!r}; use a unique disposable project name")
    project = require(project_manager.CreateProject(args.project_name), "failed to create disposable Resolve project")
    media_pool = require(project.GetMediaPool(), "Resolve media pool is unavailable")

    timeline = require(
        media_pool.ImportTimelineFromFile(
            str(args.otio.resolve()),
            {
                "timelineName": args.timeline_name,
                "importSourceClips": True,
                "sourceClipsPath": str(args.media_root.resolve()),
            },
        ),
        "Resolve failed to import OTIO fixture/relink source media",
    )
    require(project.SetCurrentTimeline(timeline), "failed to set imported timeline current")

    tracks: list[dict[str, Any]] = []
    for track_type in ("video", "audio"):
        count = int(timeline.GetTrackCount(track_type) or 0)
        for index in range(1, count + 1):
            items = timeline.GetItemListInTrack(track_type, index) or []
            tracks.append(
                {
                    "type": track_type,
                    "index": index,
                    "items": [item_evidence(item) for item in items],
                }
            )

    export_otio = getattr(resolve, "EXPORT_OTIO", None)
    export_none = getattr(resolve, "EXPORT_NONE", None)
    if export_otio is None or export_none is None:
        raise RuntimeError("Resolve scripting constants EXPORT_OTIO/EXPORT_NONE are unavailable")
    require(timeline.Export(str(args.roundtrip.resolve()), export_otio, export_none), "Resolve OTIO re-export failed")

    version = resolve.GetVersion() if hasattr(resolve, "GetVersion") else None
    evidence = {
        "schemaVersion": "phase10-davinci-otio-roundtrip-evidence/v1",
        "resolveVersion": version,
        "projectName": args.project_name,
        "timelineName": timeline.GetName(),
        "sourceOtio": str(args.otio.resolve()),
        "mediaRoot": str(args.media_root.resolve()),
        "roundtripOtio": str(args.roundtrip.resolve()),
        "tracks": tracks,
    }
    args.evidence.write_text(json.dumps(evidence, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "evidence": str(args.evidence), "roundtrip": str(args.roundtrip)}))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # explicit manual-gate failure surface
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
