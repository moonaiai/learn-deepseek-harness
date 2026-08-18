#!/usr/bin/env python3
"""
Cross-chapter relative-link integrity check for content/chapters and
content/docs:

1. Every relative link `](../slug/README[.zh].md...)` must resolve to a real
   chapter/doc directory.
2. Every `.zh.md` file's relative chapter links should point at `.zh.md`
   targets, not the English `.md` twin — a Chinese chapter linking to
   another chapter's English README is a locale leak.
"""
import re
import sys
from pathlib import Path

CONTENT = Path(__file__).resolve().parent.parent / "content"
LINK_RE = re.compile(r"\]\(\.\./([\w-]+)/(README(?:\.zh)?\.md)(#[^)]*)?\)")


def main():
    if not CONTENT.exists():
        print(f"ERROR: content directory not found at {CONTENT}", file=sys.stderr)
        sys.exit(2)

    problems = []
    all_dirs = {p.name for p in (CONTENT / "chapters").iterdir() if p.is_dir()} | {
        p.name for p in (CONTENT / "docs").iterdir() if p.is_dir()
    }

    checked = 0
    for base in ("chapters", "docs"):
        for md_path in sorted((CONTENT / base).rglob("README*.md")):
            checked += 1
            is_zh = md_path.name.endswith(".zh.md")
            text = md_path.read_text(encoding="utf-8")
            for m in LINK_RE.finditer(text):
                target_dir, target_file, _anchor = m.groups()
                if target_dir not in all_dirs:
                    problems.append(f"{md_path.relative_to(CONTENT)}: broken link to ../{target_dir}/{target_file}")
                elif is_zh and target_file == "README.md":
                    problems.append(
                        f"{md_path.relative_to(CONTENT)}: zh file links to English twin ../{target_dir}/README.md"
                    )

    print(f"Checked {checked} files for cross-chapter link integrity.")
    if problems:
        print(f"FOUND {len(problems)} PROBLEM(S):")
        for p in problems:
            print(f"  - {p}")
        sys.exit(1)
    else:
        print("All cross-chapter relative links resolve to real directories; no zh->en locale leaks.")
        sys.exit(0)


if __name__ == "__main__":
    main()
