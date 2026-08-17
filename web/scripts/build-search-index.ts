/**
 * Build-time script (run via `npm run generate`, wired as `predev`/`prebuild`)
 * that indexes every chapter and doc, per locale, into a Minisearch JSON blob
 * consumed client-side by the search UI. This is the one generated artifact
 * in the repo — unlike learn-claude-code's `versions.json`/`docs.json`, it is
 * derived output only (never hand-edited) and is gitignored.
 */
import fs from "node:fs";
import path from "node:path";
import MiniSearch from "minisearch";
import { getAllChapters, getAllDocs } from "../src/lib/content";
import type { Locale } from "../src/lib/types";

interface SearchDoc {
  id: string;
  locale: Locale;
  kind: "chapter" | "doc";
  slug: string;
  title: string;
  summary: string;
  body: string;
}

function collect(locale: Locale): SearchDoc[] {
  const chapters = getAllChapters(locale).map(
    (c): SearchDoc => ({
      id: `chapter:${locale}:${c.slug}`,
      locale,
      kind: "chapter",
      slug: c.slug,
      title: c.title,
      summary: c.summary,
      body: c.plainText,
    }),
  );
  const docs = getAllDocs(locale).map(
    (d): SearchDoc => ({
      id: `doc:${locale}:${d.slug}`,
      locale,
      kind: "doc",
      slug: d.slug,
      title: d.title,
      summary: d.summary,
      body: d.plainText,
    }),
  );
  return [...chapters, ...docs];
}

function buildIndexFor(locale: Locale) {
  const documents = collect(locale);
  const index = new MiniSearch<SearchDoc>({
    fields: ["title", "summary", "body"],
    storeFields: ["locale", "kind", "slug", "title", "summary"],
    searchOptions: { boost: { title: 3, summary: 2 }, prefix: true, fuzzy: 0.2 },
  });
  index.addAll(documents);
  return index.toJSON();
}

function main() {
  // Written to public/ (not src/data/) so it ships as a static asset the
  // browser fetches at runtime — `useSearchIndex` requests it relative to
  // NEXT_PUBLIC_BASE_PATH, exactly like any other file under public/.
  const outDir = path.join(process.cwd(), "public");
  fs.mkdirSync(outDir, { recursive: true });
  for (const locale of ["zh", "en"] as Locale[]) {
    const json = buildIndexFor(locale);
    fs.writeFileSync(path.join(outDir, `search-index.${locale}.json`), JSON.stringify(json));
  }
  console.log("Search index generated for locales: zh, en");
}

main();
