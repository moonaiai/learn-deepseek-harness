"use client";

import { useEffect, useRef, useState } from "react";
import MiniSearch from "minisearch";
import type { Locale } from "@/lib/types";

export interface SearchHit {
  id: string;
  locale: Locale;
  kind: "chapter" | "doc";
  slug: string;
  title: string;
  summary: string;
}

/**
 * Loads the locale-scoped Minisearch index (built by
 * `scripts/build-search-index.ts` and served as a static asset) on first use
 * and exposes a `search(query)` function. The index fetch is lazy — it only
 * happens once the user opens the search UI — so it never costs anything on
 * pages that don't need it.
 */
export function useSearchIndex(locale: Locale) {
  const indexRef = useRef<MiniSearch<SearchHit> | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    indexRef.current = null;
    setReady(false);
  }, [locale]);

  async function ensureLoaded() {
    if (indexRef.current || loading) return;
    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      const res = await fetch(`${base}/search-index.${locale}.json`);
      const json = await res.json();
      indexRef.current = MiniSearch.loadJSON<SearchHit>(JSON.stringify(json), {
        fields: ["title", "summary", "body"],
        storeFields: ["locale", "kind", "slug", "title", "summary"],
      });
      setReady(true);
    } finally {
      setLoading(false);
    }
  }

  function search(query: string): SearchHit[] {
    if (!indexRef.current || !query.trim()) return [];
    return indexRef.current
      .search(query, { prefix: true, fuzzy: 0.2, boost: { title: 3, summary: 2 } })
      .slice(0, 12) as unknown as SearchHit[];
  }

  return { ensureLoaded, search, ready, loading };
}
