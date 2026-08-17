import Link from "next/link";
import type { TocEntry } from "@/lib/markdown";

/** Static (server-rendered) table of contents built from the chapter's own
 * `##`/`###` headings — no client-side scroll-spy, just anchor links, kept
 * intentionally simple since chapters are read top-to-bottom. */
export function TableOfContents({ toc, title }: { toc: TocEntry[]; title: string }) {
  if (toc.length === 0) return null;
  return (
    <nav className="sticky top-20 hidden w-56 shrink-0 self-start xl:block">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[--color-text-faint]">{title}</p>
      <ul className="space-y-1.5 text-sm">
        {toc.map((entry) => (
          <li key={entry.id} className={entry.depth === 3 ? "pl-3" : undefined}>
            <Link
              href={`#${entry.id}`}
              className="line-clamp-2 text-[--color-text-muted] transition-colors hover:text-blue-600 dark:hover:text-blue-400"
            >
              {entry.text}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
