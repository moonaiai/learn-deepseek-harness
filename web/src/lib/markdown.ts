import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeExternalLinks from "rehype-external-links";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";
import { remarkSourceViewerMeta } from "./remark-source-viewer-meta";
import type { TocEntry } from "./types";

export type { TocEntry };

/**
 * Renders chapter/doc Markdown body to static HTML at build time (Node-only:
 * called from Server Components and from `scripts/build-search-index.ts`,
 * never from a "use client" module).
 *
 * Mermaid fences (```mermaid) are deliberately left as plain
 * `<code class="language-mermaid">` text — {@link MermaidDiagram} finds and
 * hydrates them client-side rather than the server pre-rendering SVG, since
 * mermaid's renderer needs a DOM. Fenced code blocks with a `filename="..."`
 * meta string (see `remarkSourceViewerMeta`) get a `data-filename` attribute
 * picked up the same way by `SourceViewerHydrator`, which swaps them for a
 * terminal-styled `SourceViewer` — the highlighted spans `rehype-highlight`
 * produces are reused as-is, not re-tokenized.
 */
const pipeline = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkSourceViewerMeta)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSlug)
  .use(rehypeExternalLinks, { target: "_blank", rel: ["noopener", "noreferrer"] })
  .use(rehypeHighlight, { detect: false, ignoreMissing: true })
  .use(rehypeStringify, { allowDangerousHtml: true });

export interface RenderedMarkdown {
  html: string;
  /** Plain text with all tags stripped, used to build the search index. */
  plainText: string;
  toc: TocEntry[];
}

const HEADING_RE = /<h([23]) id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g;
const TAG_RE = /<[^>]+>/g;

function stripTags(html: string): string {
  return html.replace(TAG_RE, "").trim();
}

function extractToc(html: string): TocEntry[] {
  const entries: TocEntry[] = [];
  for (const match of html.matchAll(HEADING_RE)) {
    const depth = Number(match[1]) as 2 | 3;
    entries.push({ depth, id: match[2], text: stripTags(match[3]) });
  }
  return entries;
}

export function renderMarkdown(source: string): RenderedMarkdown {
  const html = String(pipeline.processSync(source));
  return { html, plainText: stripTags(html), toc: extractToc(html) };
}
