# `content/` authoring contract

This directory is the single source of truth for the course. Nothing here is generated; the web app (`web/src/lib/content.ts`) reads these files directly from disk at build time.

## Layout

```
content/
  chapters/
    s01-cordis-primer/
      README.zh.md
      README.md
    s02-profiles-and-bundles/
      ...
  docs/
    glossary/
      README.zh.md
      README.md
    concept-map/
      README.zh.md
      README.md
```

- `chapters/sNN-slug/` — one directory per course chapter, numbered `s01`..`s20`. The directory name's `sNN-slug` prefix has no parsing significance to the app (the real ordering key is the `order` frontmatter field) but MUST stay sorted-consistent with `order` for readability.
- `docs/slug/` — standalone reference pages outside the chapter sequence (`glossary`, `concept-map`). Same two-file-per-directory shape.
- Each directory holds **exactly two files**: `README.zh.md` (Chinese) and `README.md` (English). Neither is a translation stub — both are complete, independently readable chapters.

## Frontmatter schema

Every file starts with YAML frontmatter. Both locale files for the same chapter/doc MUST share the same `id`, `slug`, `module` (chapters only), and `order` (chapters only) — only `title`, `summary`, and the prose body differ by locale.

### Chapters

```yaml
---
id: s01
slug: s01-cordis-primer
title: "Cordis 五个核心概念"       # localized per file
summary: "一句话概括本章内容"       # localized per file
module: foundations               # one of: foundations | loop | collab | memory | ops
order: 1                          # global 1..20 ordering, identical in both locale files
sources:
  - path: docs/cordis-primer.md
    label: "Cordis 五个核心概念"
  - path: packages/core/session/src/types.ts
    lineStart: 12
    lineEnd: 40
    label: "SessionEvent 判别式联合"
---
```

- `sources` entries are rendered as clickable badges linking to `github.com/deepseek-ai/deepseek-harness/blob/<anchored-commit>/<path>#L<start>-L<end>`. **Every path/line pair must be verified against the actual deepseek-harness checkout before merging** — never invent a plausible-looking path or line number. Omit `lineStart`/`lineEnd` when citing a whole file or a whole doc page.
- `label` is optional, shown after the path as a short human gloss.

### Docs (glossary, concept-map)

Same shape minus `module`/`order`:

```yaml
---
id: glossary
slug: glossary
title: "术语表"
summary: "DeepSeek Harness 的核心词汇"
sources: [...]
---
```

## Body conventions

- Plain Markdown (GFM tables/task lists supported). One `#` H1 is implied by the page template from `title` — **do not add your own `# Heading`** at the top of the body; start with `##`.
- Use ` ```mermaid ` fenced code blocks for diagrams; they render as live interactive SVG. Prefer adapting a diagram that already exists in `docs/*.md` (e.g. `docs/agent-lifecycle.md`, `docs/capability-seams.md`, `docs/tool-execution-pipeline.md`, `docs/module-graph.md`) over inventing a new one, so the diagram stays traceable to the project's own generated docs.
- Reference real code with fenced code blocks (```` ```ts ````, etc.); precede any nontrivial excerpt with the matching `sources` entry so the reader can jump to the live file.
- No editorializing about the writing process itself (no "as we saw earlier", no meta-commentary about the course) — write as current-state technical prose, same register as the rest of the deepseek-harness documentation it draws from.
