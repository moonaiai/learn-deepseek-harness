/**
 * Shared content types for the course site. A "chapter" is one of the 24
 * numbered lessons (s01..s24); a "doc" is a standalone reference page
 * (glossary, concept map) that lives outside the chapter sequence.
 */

export type Locale = "zh" | "en";

export const LOCALES: Locale[] = ["zh", "en"];

export const DEFAULT_LOCALE: Locale = "zh";

/** Narrows a route param string to {@link Locale}, falling back to the
 * default. Next's generated route-type validator infers page/layout `params`
 * as `Promise<{ locale: string }>` (it can't see that `generateStaticParams`
 * only ever emits "zh"/"en"), so every `params` destructure narrows through
 * this function rather than asserting the literal union directly. */
export function resolveLocale(value: string): Locale {
  return value === "en" ? "en" : DEFAULT_LOCALE;
}

export type ModuleId =
  | "foundations"
  | "execution-seams"
  | "world-and-collab-seams"
  | "extension-memory-seams"
  | "orchestration-and-capstone";

/** One row in a chapter's frontmatter `sources` list — a precise, checkable
 * pointer into the deepseek-harness repository at the anchored commit. */
export interface SourceRef {
  path: string;
  lineStart?: number;
  lineEnd?: number;
  label?: string;
}

interface FrontmatterBase {
  id: string;
  slug: string;
  title: string;
  summary: string;
  sources?: SourceRef[];
}

export interface ChapterFrontmatter extends FrontmatterBase {
  module: ModuleId;
  order: number;
}

/** A single `##`/`###` heading extracted from rendered chapter/doc HTML,
 * used to build the in-page table of contents. Re-exported here (rather than
 * only from `lib/markdown.ts`) so `Chapter`/`Doc` consumers don't need a
 * second import for a field on their own type. */
export interface TocEntry {
  id: string;
  text: string;
  depth: 2 | 3;
}

export interface Chapter extends ChapterFrontmatter {
  locale: Locale;
  html: string;
  plainText: string;
  toc: TocEntry[];
}

export interface DocFrontmatter extends FrontmatterBase {}

export interface Doc extends DocFrontmatter {
  locale: Locale;
  html: string;
  plainText: string;
  toc: TocEntry[];
}
