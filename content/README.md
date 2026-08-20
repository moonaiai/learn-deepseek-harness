# `content/` authoring contract

This directory is the single source of truth for the course. Nothing here is generated; the web app (`web/src/lib/content.ts`) reads these files directly from disk at build time.

## Organizing axis: capability seams, not a subsystem tour

The course is organized around **capability seams** — deepseek-harness's own term (`docs/glossary.md`, `.agents/notes/implemented/architecture/2026-06-13-capability-seams.md`) for a swappable capability made of exactly three roles: a Service Definition, one or more Service Providers, and one or more Consumers.

Five modules, in reading order:

1. **`foundations`** — the core spine that is deliberately *not* a seam: Cordis, profiles/bundles, the session log, the turn/step driver, the tool pipeline, and the capability-seam pattern itself (taught once, in depth, using the shell seam as the worked example).
2. **`execution-seams`** — filesystem/LSP, subprocess/terminal, sandbox: the swappable backend families sharing one execution world.
3. **`world-and-collab-seams`** — the LLM and web vendor seams, plus the human-collaboration mechanisms (approval, questions, hooks, todo/plan mode) — several of which are *not* seams, and the chapter says so explicitly.
4. **`extension-memory-seams`** — subagents, skills, compaction, session persistence: the seams with the widest provider fan-out.
5. **`orchestration-and-capstone`** — background-work seams, presets/self-modification, MCP/automation, error recovery, and the capstone.

**A chapter about a mechanism that is *not* a capability seam must say so directly**, and explain why (single implementation with no swap need, a plain Consumer with no Definition of its own, a composition point over other seams, etc.). Do not force a Definition/Provider/Consumer framing onto something the project's own docs don't describe that way — `docs/capability-seams.md` (generated) classifies every `ctx.<key>` row's `Role` as `seam`, `core`, or `bundle`; check it before claiming a mechanism is a seam.

## Layout

```
content/
  chapters/
    s01-cordis-primer/
      README.zh.md
      README.md
      sources.zh.json
      sources.en.json
      decisions.json
      showcase.json
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

- `chapters/sNN-slug/` — one directory per course chapter, numbered `s01`..`s24`. The directory name's `sNN-slug` prefix has no parsing significance to the app (the real ordering key is the `order` frontmatter field) but MUST stay sorted-consistent with `order` for readability.
- `docs/slug/` — standalone reference pages outside the chapter sequence (`glossary`, `concept-map`). Same two-file-per-directory shape.
- Each chapter directory holds **exactly two prose files** (`README.zh.md` and `README.md`, complete and independently readable in their own language) plus the data files below. A chapter with no decisions or showcase data simply omits that file.

## Frontmatter schema

Every prose file starts with YAML frontmatter. Both locale files for the same chapter/doc MUST share the same `id`, `slug`, `module` (chapters only), and `order` (chapters only) — only `title`, `summary`, and the prose body differ by locale.

### Chapters

```yaml
---
id: s01
slug: s01-cordis-primer
title: "Cordis 五个核心概念"       # localized per file
summary: "一句话概括本章内容"       # localized per file
module: foundations               # one of: foundations | execution-seams | world-and-collab-seams | extension-memory-seams | orchestration-and-capstone
order: 1                          # global 1..24 ordering, identical in both locale files
---
```

Frontmatter carries **only** the chapter's own identity metadata — the deep-link source list lives in `sources.{locale}.json`, not here.

### Docs (glossary, concept-map)

Same shape minus `module`/`order`:

```yaml
---
id: glossary
slug: glossary
title: "术语表"
summary: "DeepSeek Harness 的核心词汇"
---
```

## Chapter data files

### `sources.{locale}.json`

The chapter's deep-link source list, one file per locale because the two languages may cite different doc twins (e.g. `docs/architecture.md` vs `docs/architecture.zh.md`). Rendered as clickable badges linking to `github.com/deepseek-ai/deepseek-harness/blob/<anchored-commit>/<path>#L<start>-L<end>`.

```json
{
  "sources": [
    { "path": "docs/cordis-primer.md", "label": "Cordis 五个核心概念" },
    { "path": "packages/core/session/src/types.ts", "lineStart": 12, "lineEnd": 40, "label": "SessionEvent 判别式联合" }
  ]
}
```

- **Every path/line pair must be verified against the actual deepseek-harness checkout before merging** — never invent a plausible-looking path or line number. Omit `lineStart`/`lineEnd` when citing a whole file or a whole doc page.
- `label` is optional, shown after the path as a short human gloss.

### `decisions.json`

The chapter's Deep-Dive design-decision entries, distilled from the corresponding Agent Note(s) in the deepseek-harness repository (`.agents/notes/implemented/architecture/` or `feature/`), preserving the note's own Problem/Decision/Alternatives-considered structure. Bilingual: every entry has `en` and `zh` text.

```json
{
  "decisions": [
    {
      "id": "short-kebab-case-id",
      "title": { "en": "Decision title", "zh": "决策标题" },
      "description": { "en": "Why this decision was made.", "zh": "为什么做出这个决定。" },
      "alternatives": { "en": "What alternatives were considered and rejected.", "zh": "考虑过但被否决的备选方案。" }
    }
  ]
}
```

### `showcase.json`

A chapter's StepDiagram and/or SeamSimulator data — only a handful of chapters have this file; most render through the plain Markdown+Mermaid baseline. If you are asked to add or update a showcase entry:

- Every node label, event name, and provider name in the showcase data must be traceable to that chapter's own `sources` citations. This is illustrative UI data, not a place to invent a plausible-sounding event that isn't in the real event vocabulary.
- A `diagram` entry needs `nodes`/`edges` (fixed layout) and `steps` (each naming which node/edge ids are "active" at that step, plus a title/desc). Edge routing is computed automatically (see `web/src/components/diagram/edge-routing.ts`) — do not hand-place edge paths.
- A `simulator` entry needs a `title`/`description` and an ordered `steps` array of `{ type, content, annotation, providerName? }`, where `type` is one of `request | dispatch | provider_selected | provider_execute | result`.

## Body conventions

- Plain Markdown (GFM tables/task lists supported). One `#` H1 is implied by the page template from `title` — **do not add your own `# Heading`** at the top of the body; start with `##`.
- Use ` ```mermaid ` fenced code blocks for diagrams; they render as live interactive SVG. Prefer adapting a diagram that already exists in `docs/*.md` (e.g. `docs/agent-lifecycle.md`, `docs/capability-seams.md`, `docs/tool-execution-pipeline.md`, `docs/module-graph.md`) over inventing a new one, so the diagram stays traceable to the project's own generated docs.
- Reference real code with fenced code blocks (```` ```ts ````, etc.); precede any nontrivial excerpt with the matching `sources.{locale}.json` entry so the reader can jump to the live file.
- **One flagship excerpt per chapter may use `filename="..."` meta** to render as a terminal-styled `SourceViewer` instead of a plain code block:
  ````
  ```ts filename="packages/core/tools/src/schema.ts"
  export function defineTool<...>(...) { ... }
  ```
  ````
  The path in `filename=` should match a `sources.{locale}.json` entry for the same chapter. Use this sparingly — one genuinely representative excerpt per chapter, not every code block — since its visual weight is meant to mark "the one snippet worth lingering on."
- No editorializing about the writing process itself (no "as we saw earlier", no meta-commentary about the course) — write as current-state technical prose, same register as the rest of the deepseek-harness documentation it draws from.

## Structured content blocks

The render pipeline (`web/src/lib/remark-content-blocks.ts`, registered in `web/src/lib/markdown.ts`) turns a small set of Markdown conventions into styled, sometimes interactive blocks. Use them to break the uniform prose wall — but only where they genuinely fit; substance over quantity.

- **Callout** — a blockquote whose first line is a marker: `> [!WHY]` (reasoning), `> [!LIMITATION]` (constraint), `> [!NOTE]` (aside), `> [!PITFALL]` (gotcha). The marker is stripped and the blockquote is color-coded and labelled. Use for the "why was it built this way" / "watch out" / "note that" sentences.
- **Concept card** — `:::concept{term="X"}` … `:::` lifts a defined term out of the prose into a labelled card. Use for dense "a X is…" vocabulary definitions.
- **Decision card** — `:::decision` … `:::` for an inline "we chose X over Y" rationale, placed where the topic arises (the in-flow counterpart to the bottom-of-chapter Deep-Dive `decisions.json`).
- **Timeline** — `:::timeline` containing a `- title — caption` list … `:::` renders as a caption-synced step-through (play/pause/step) for an ordered process. Use ONLY for genuinely ordered mechanisms (append → validate → commit → notify); skip if the chapter has no ordered flow.
- **Fold** — `:::fold[Summary]` … `:::` renders as a collapsible `<details>`; the bracket label (no space before `[`) becomes the summary. Use to bury secondary deep-dives and tangents.

Authoring rules:

- Every directive block opens with `:::name` and closes with a bare `:::` — keep them balanced. `:::fold` uses a bracket label with **no space** (`:::fold[Text]`); `:::concept` uses curly-brace attrs (`:::concept{term="…"}`).
- Both locale files must use the same blocks in the same places (translated text where natural).
- Do not change meaning, citations, code, or source links when re-wrapping text into blocks — this is a presentation transformation, not a content rewrite.
