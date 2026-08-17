"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search as SearchIcon, X } from "lucide-react";
import { useSearchIndex, type SearchHit } from "@/hooks/use-search-index";
import type { Locale } from "@/lib/types";

/**
 * A ⌘K / Ctrl+K command-palette-style search overlay. Opens lazily loading
 * the locale's Minisearch index on first open (see `useSearchIndex`), then
 * queries entirely client-side — there is no network round-trip per
 * keystroke.
 */
export function CommandSearch({ locale, placeholder }: { locale: Locale; placeholder: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { ensureLoaded, search } = useSearchIndex(locale);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isCombo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isCombo) {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      void ensureLoaded();
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery("");
      setHits([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ensureLoaded is stable per locale render
  }, [open]);

  function onChange(value: string) {
    setQuery(value);
    setHits(search(value));
  }

  function go(hit: SearchHit) {
    setOpen(false);
    // Chapters and docs (glossary, concept-map) both resolve at /{locale}/{slug} —
    // `hit.kind` is retained for the UI grouping above, not for routing.
    router.push(`/${hit.locale}/${hit.slug}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-[--color-border] bg-[--color-surface] px-3 py-1.5 text-sm text-[--color-text-muted] transition-colors hover:border-blue-500/40"
      >
        <SearchIcon size={15} />
        <span className="hidden sm:inline">{placeholder}</span>
        <kbd className="hidden rounded border border-[--color-border] px-1.5 py-0.5 font-mono text-[10px] sm:inline">
          ⌘K
        </kbd>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl border border-[--color-border] bg-[--color-surface] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-[--color-border] px-4 py-3">
              <SearchIcon size={16} className="text-[--color-text-muted]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-transparent text-sm outline-none"
              />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close">
                <X size={16} className="text-[--color-text-muted]" />
              </button>
            </div>
            {hits.length > 0 ? (
              <ul className="max-h-96 overflow-y-auto py-2">
                {hits.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      onClick={() => go(hit)}
                      className="flex w-full flex-col items-start gap-0.5 px-4 py-2 text-left transition-colors hover:bg-[--color-surface-hover]"
                    >
                      <span className="text-sm font-medium">{hit.title}</span>
                      <span className="line-clamp-1 text-xs text-[--color-text-muted]">{hit.summary}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : query ? (
              <p className="px-4 py-6 text-center text-sm text-[--color-text-muted]">No results</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
