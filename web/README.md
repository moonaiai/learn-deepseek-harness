# web/

Next.js 16 (App Router, static export) rendering base for the course. See the repository root [README.md](../README.md) for what this project is; see [content/README.md](../content/README.md) for how chapters are authored.

```sh
npm install
npm run dev     # http://localhost:3000, regenerates the search index first
npm run build   # static export to out/
npm run typecheck
```

## Layout

- `src/app/[locale]/` — routes (`/`, `/[slug]` for chapters, `/glossary`, `/concept-map`), locale = `zh` | `en`.
- `src/lib/content.ts` — reads `../content/{chapters,docs}/*/README*.md` at build time; the only content data source.
- `src/lib/markdown.ts` — Markdown → HTML pipeline (unified/remark/rehype), run server-side.
- `src/components/diagram/` — Mermaid rendering (client island, hydrates `language-mermaid` code fences found in server-rendered HTML).
- `src/hooks/use-search-index.ts` + `scripts/build-search-index.ts` — Minisearch index, generated to `public/search-index.{locale}.json` by `npm run generate` (wired as `predev`/`prebuild`).
- `src/lib/progress.ts` + `src/hooks/use-progress.ts` — localStorage-backed reading-progress tracking.
