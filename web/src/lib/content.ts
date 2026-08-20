import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { renderMarkdown } from "./markdown";
import type {
  Chapter,
  ChapterFrontmatter,
  Doc,
  DocFrontmatter,
  Locale,
  SourceRef,
} from "./types";
import { DEFAULT_LOCALE } from "./types";

/**
 * The single data source for all course content. A chapter is an explicit
 * data package under `content/chapters/sNN-slug/`:
 *
 *   README.zh.md / README.md   prose body (frontmatter: id/slug/title/
 *                              summary/module/order only)
 *   sources.{zh,en}.json       deep-link list (moved out of frontmatter)
 *   decisions.json             Deep-Dive design-decision entries
 *   showcase.json              StepDiagram/SeamSimulator data
 *
 * Files are read directly from disk at build time — there is no intermediate
 * generated content JSON and no build-time scan of any repository other than
 * this one. `decisions.json`/`showcase.json` are absent for chapters that
 * lack the corresponding data; their consumers treat absence as "no data
 * for that tab".
 */
const CONTENT_ROOT = path.join(process.cwd(), "..", "content");
const CHAPTERS_ROOT = path.join(CONTENT_ROOT, "chapters");
const DOCS_ROOT = path.join(CONTENT_ROOT, "docs");

function localeFileName(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? "README.zh.md" : "README.md";
}

function readTextIfExists(filePath: string): string | null {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
}

function readJsonIfExists<T>(filePath: string): T | null {
  const raw = readTextIfExists(filePath);
  return raw === null ? null : (JSON.parse(raw) as T);
}

function readMarkdownFile(dir: string, locale: Locale): { data: Record<string, unknown>; content: string } {
  const filePath = path.join(dir, localeFileName(locale));
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);
  return { data: parsed.data, content: parsed.content };
}

function assertChapterFrontmatter(data: Record<string, unknown>, dir: string): ChapterFrontmatter {
  const required = ["id", "slug", "title", "summary", "module", "order"] as const;
  for (const key of required) {
    if (!(key in data)) {
      throw new Error(`Chapter frontmatter in ${dir} is missing required field "${key}"`);
    }
  }
  return data as unknown as ChapterFrontmatter;
}

function assertDocFrontmatter(data: Record<string, unknown>, dir: string): DocFrontmatter {
  const required = ["id", "slug", "title", "summary"] as const;
  for (const key of required) {
    if (!(key in data)) {
      throw new Error(`Doc frontmatter in ${dir} is missing required field "${key}"`);
    }
  }
  return data as unknown as DocFrontmatter;
}

function readSources(dir: string, locale: Locale): SourceRef[] {
  const parsed = readJsonIfExists<{ sources?: SourceRef[] }>(
    path.join(dir, `sources.${locale}.json`),
  );
  return parsed?.sources ?? [];
}

let chapterCache: Map<Locale, Chapter[]> | null = null;

function loadAllChapters(): Map<Locale, Chapter[]> {
  if (chapterCache) return chapterCache;
  const dirs = fs
    .readdirSync(CHAPTERS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const byLocale = new Map<Locale, Chapter[]>([
    ["zh", []],
    ["en", []],
  ]);

  for (const dirName of dirs) {
    const dir = path.join(CHAPTERS_ROOT, dirName);
    for (const locale of ["zh", "en"] as Locale[]) {
      const { data, content } = readMarkdownFile(dir, locale);
      const fm = assertChapterFrontmatter(data, dir);
      const { html, plainText, toc } = renderMarkdown(content);
      byLocale.get(locale)!.push({ ...fm, locale, html, plainText, toc, sources: readSources(dir, locale) });
    }
  }

  for (const list of byLocale.values()) list.sort((a, b) => a.order - b.order);
  chapterCache = byLocale;
  return byLocale;
}

export function getAllChapters(locale: Locale): Chapter[] {
  return loadAllChapters().get(locale) ?? [];
}

export function getChapter(locale: Locale, slug: string): Chapter | undefined {
  return getAllChapters(locale).find((c) => c.slug === slug);
}

export function getAdjacentChapters(
  locale: Locale,
  slug: string,
): { prev: Chapter | null; next: Chapter | null } {
  const all = getAllChapters(locale);
  const index = all.findIndex((c) => c.slug === slug);
  if (index === -1) return { prev: null, next: null };
  return {
    prev: index > 0 ? all[index - 1] : null,
    next: index < all.length - 1 ? all[index + 1] : null,
  };
}

let docCache: Map<Locale, Doc[]> | null = null;

function loadAllDocs(): Map<Locale, Doc[]> {
  if (docCache) return docCache;
  const dirs = fs
    .readdirSync(DOCS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const byLocale = new Map<Locale, Doc[]>([
    ["zh", []],
    ["en", []],
  ]);

  for (const dirName of dirs) {
    const dir = path.join(DOCS_ROOT, dirName);
    for (const locale of ["zh", "en"] as Locale[]) {
      const { data, content } = readMarkdownFile(dir, locale);
      const fm = assertDocFrontmatter(data, dir);
      const { html, plainText, toc } = renderMarkdown(content);
      byLocale.get(locale)!.push({ ...fm, locale, html, plainText, toc });
    }
  }

  docCache = byLocale;
  return byLocale;
}

export function getAllDocs(locale: Locale): Doc[] {
  return loadAllDocs().get(locale) ?? [];
}

export function getDoc(locale: Locale, slug: string): Doc | undefined {
  return getAllDocs(locale).find((d) => d.slug === slug);
}
