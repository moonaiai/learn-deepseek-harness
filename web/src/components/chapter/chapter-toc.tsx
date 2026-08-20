"use client";

import { useEffect, useRef, useState } from "react";
import type { TocEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * A scroll-spy "On this page" sidebar for the chapter document. The chapter's
 * rendered HTML is a flat, flowing document (Reading/Visualize/Play/Deep-Dive
 * sections), so the TOC mirrors the headings the reader actually scrolls
 * past — an IntersectionObserver over the rendered `h2`/`h3` elements marks
 * the active entry, and clicking one scrolls to it. Rendered only on xl
 * screens; on smaller viewports the chapter is a single-column flow anyway.
 */
export function ChapterToc({ entries, title }: { entries: TocEntry[]; title: string }) {
  const [activeId, setActiveId] = useState<string | null>(entries[0]?.id ?? null);
  const activeIdRef = useRef<string | null>(activeId);
  activeIdRef.current = activeId;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (observed) => {
        // Prefer the topmost heading currently entering the viewport band,
        // falling back to reading the last one we know was on screen.
        for (const entry of observed) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      // A heading counts as "active" when it crosses the upper viewport band
      // under the sticky header — a thin horizontal strip rather than the
      // whole viewport, so the active entry tracks the read position.
      { rootMargin: "-64px 0px -70% 0px", threshold: 0 },
    );

    const targets = entries
      .map((e) => document.getElementById(e.id))
      .filter((el): el is HTMLElement => el != null);
    for (const el of targets) observer.observe(el);
    return () => observer.disconnect();
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <aside className="sticky top-16 hidden max-h-[calc(100vh-6rem)] w-56 shrink-0 self-start overflow-y-auto pb-6 xl:block">
      <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-[--color-text-faint]">
        {title}
      </p>
      <nav>
        <ul className="space-y-0.5 border-l border-[--color-border]">
          {entries.map((entry) => {
            const active = entry.id === activeId;
            return (
              <li key={entry.id}>
                <a
                  href={`#${entry.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(entry.id)?.scrollIntoView({ behavior: "smooth" });
                    setActiveId(entry.id);
                  }}
                  className={cn(
                    "block border-l-2 py-1 text-[13px] leading-snug transition-colors",
                    entry.depth === 3 ? "pl-6" : "pl-3",
                    active
                      ? "border-blue-500 font-medium text-[--color-text]"
                      : "border-transparent text-[--color-text-muted] hover:text-[--color-text]",
                  )}
                >
                  {entry.text}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
