#!/usr/bin/env python3
"""
Verifies every `sources` frontmatter entry across content/chapters and
content/docs against the real deepseek-harness checkout: the cited path must
exist, and if lineStart/lineEnd are given, the file must have at least that
many lines. Does not (cannot, cheaply) verify that the cited lines say what
the prose claims -- that requires a human/agent spot-check -- but it catches
the class of error this course cares most about: an invented or stale path.
"""
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("PyYAML not installed; run: pip3 install pyyaml", file=sys.stderr)
    sys.exit(2)

REPO_ROOT = Path("/opt/workspace/deepseek-harness")
COURSE_CONTENT = Path("/opt/workspace/learn-deepseek-harness/content")

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)


def load_frontmatter(path: Path):
    text = path.read_text(encoding="utf-8")
    m = FRONTMATTER_RE.match(text)
    if not m:
        return None, f"no frontmatter block found"
    try:
        data = yaml.safe_load(m.group(1))
    except yaml.YAMLError as e:
        return None, f"YAML parse error: {e}"
    return data, None


def check_file(md_path: Path):
    problems = []
    data, err = load_frontmatter(md_path)
    if err:
        problems.append(err)
        return problems
    if data is None:
        problems.append("frontmatter parsed to None")
        return problems

    for field in ("id", "slug", "title", "summary"):
        if field not in data:
            problems.append(f"missing required frontmatter field: {field}")

    sources = data.get("sources") or []
    if not isinstance(sources, list):
        problems.append("`sources` is not a list")
        sources = []

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


def main():
    if not REPO_ROOT.exists():
        print(f"ERROR: deepseek-harness checkout not found at {REPO_ROOT}", file=sys.stderr)
        sys.exit(2)

    md_files = sorted(COURSE_CONTENT.rglob("README*.md"))
    if not md_files:
        print(f"ERROR: no README*.md files found under {COURSE_CONTENT}", file=sys.stderr)
        sys.exit(2)

    total_sources = 0
    total_problems = 0
    files_with_problems = 0

    for md_path in md_files:
        rel = md_path.relative_to(COURSE_CONTENT)
        data, _ = load_frontmatter(md_path)
        n_sources = len((data or {}).get("sources") or []) if isinstance(data, dict) else 0
        total_sources += n_sources

        problems = check_file(md_path)
        if problems:
            files_with_problems += 1
            total_problems += len(problems)
            print(f"\n[FAIL] {rel} ({n_sources} sources)")
            for p in problems:
                print(f"  - {p}")

    print(f"\n{'=' * 60}")
    print(f"Checked {len(md_files)} files, {total_sources} total source entries.")
    if total_problems:
        print(f"FOUND {total_problems} PROBLEM(S) in {files_with_problems} file(s).")
        sys.exit(1)
    else:
        print("All source citations verified: every path exists, every line range is in bounds.")
        sys.exit(0)


if __name__ == "__main__":
    main()
