"use client";

import Link from "next/link";
import type { Chapter, Locale } from "@/lib/types";

/**
 * The right-rail "相关章节" list on a chapter page: other chapters on the
 * same module (same capability-seam topic group), computed from the course's
 * own content data (see `lib/related.ts`) — not inferred from references,
 * not hardcoded, just the module id the course already assigns to each
 * chapter. Rendered as a flat card-list filterable to three at a time to
 * keep the read page scannable.
 */
export function RelatedChapters({
  locale,
  chapters,
  title,
}: {
  locale: Locale;
  chapters: Chapter[];
  title: string;
}) {
  if (chapters.length === 0) return null;
  const shown = chapters.slice(0, 3);

  return (
    <nav className="sticky top-20 hidden w-56 shrink-0 self-start xl:block">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[--color-text-faint]">{title}</p>
      <ul className="space-y-1.5 text-sm">
        {shown.map((chapter) => (
          <li key={chapter.slug}>
            <Link
              href={`/${locale}/${chapter.slug}`}
              className="line-clamp-2 text-[--color-text-muted] transition-colors hover:text-blue-600 dark:hover:text-blue-400"
            >
              {chapter.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
