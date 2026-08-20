#!/usr/bin/env python3
"""
Verifies every `sources.{locale}.json` entry across content/chapters against
the real deepseek-harness checkout: the cited path must exist, and if
lineStart/lineEnd are given, the file must have at least that many lines.
Does not (cannot, cheaply) verify that the cited lines say what the prose
claims -- that requires a human/agent spot-check -- but it catches the class
of error this course cares most about: an invented or stale path.

Runs across every sources.{en,zh}.json file (formerly the `sources`
frontmatter field, moved out of markdown by a data-package migration).
"""
import json
import sys
from pathlib import Path

REPO_ROOT = Path("/opt/workspace/deepseek-harness")
COURSE_CONTENT = Path("/opt/workspace/learn-deepseek-harness/content")


def check_sources_file(json_path: Path, rel: str) -> list[str]:
    problems = []
    try:
        data = json.loads(json_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return [f"JSON parse error: {e}"]

    sources = data.get("sources")
    if sources is None:
        return ["missing `sources` key"]
    if not isinstance(sources, list):
        return ["`sources` is not a list"]

    for i, src in enumerate(sources):
        if not isinstance(src, dict) or "path" not in src:
            problems.append(f"sources[{i}]: missing `path`")
            continue
        rel_path = src["path"]
        abs_path = REPO_ROOT / rel_path
        if not abs_path.exists():
            problems.append(f"sources[{i}]: path does not exist: {rel_path}")
            continue
        if abs_path.is_dir():
            problems.append(f"sources[{i}]: path is a directory, not a file: {rel_path}")
            continue

        line_start = src.get("lineStart")
        line_end = src.get("lineEnd")
        if line_start is not None or line_end is not None:
            try:
                line_count = sum(1 for _ in abs_path.open("r", encoding="utf-8", errors="replace"))
            except Exception as e:
                problems.append(f"sources[{i}]: could not read {rel_path}: {e}")
                continue
            if line_start is not None and (line_start < 1 or line_start > line_count):
                problems.append(
                    f"sources[{i}]: lineStart={line_start} out of range (file has {line_count} lines): {rel_path}"
                )
            if line_end is not None and (line_end < 1 or line_end > line_count):
                problems.append(
                    f"sources[{i}]: lineEnd={line_end} out of range (file has {line_count} lines): {rel_path}"
                )
            if line_start is not None and line_end is not None and line_start > line_end:
                problems.append(f"sources[{i}]: lineStart > lineEnd ({line_start} > {line_end}): {rel_path}")

    return problems


def main() -> None:
    if not REPO_ROOT.exists():
        print(f"ERROR: deepseek-harness checkout not found at {REPO_ROOT}", file=sys.stderr)
        sys.exit(2)

    json_files = sorted(COURSE_CONTENT.glob("**/sources.*.json"))
    if not json_files:
        print(f"ERROR: no sources.*.json files found under {COURSE_CONTENT}", file=sys.stderr)
        sys.exit(2)

    total_sources = 0
    total_problems = 0
    files_with_problems = 0

    for json_path in json_files:
        rel = str(json_path.relative_to(COURSE_CONTENT))
        try:
            data = json.loads(json_path.read_text(encoding="utf-8"))
            n_sources = len(data.get("sources") or [])
        except json.JSONDecodeError:
            n_sources = 0
        total_sources += n_sources

        problems = check_sources_file(json_path, rel)
        if problems:
            files_with_problems += 1
            total_problems += len(problems)
            print(f"\n[FAIL] {rel} ({n_sources} sources)")
            for p in problems:
                print(f"  - {p}")

    print(f"\n{'=' * 60}")
    print(f"Checked {len(json_files)} files, {total_sources} total source entries.")
    if total_problems:
        print(f"FOUND {total_problems} PROBLEM(S) in {files_with_problems} file(s).")
        sys.exit(1)
    else:
        print("All source citations verified: every path exists, every line range is in bounds.")
        sys.exit(0)


if __name__ == "__main__":
    main()
