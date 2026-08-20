"use client";

import Link from "next/link";
import type { Chapter, Locale } from "@/lib/types";
import { MODULES } from "@/lib/modules";
import { moduleClasses } from "@/lib/modules";
import { cn } from "@/lib/utils";

const KIND_MARKER: Record<string, string> = {
  seam: "◆",
  "non-seam": "○",
  "non-mechanism": "·",
};

const KIND_LABEL: Record<Locale, Record<string, string> | undefined> = {
  en: {
    seam: "capability seam",
    "non-seam": "not a capability seam",
    "non-mechanism": "core spine",
  },
  zh: {
    seam: "能力接缝",
    "non-seam": "并非能力接缝",
    "non-mechanism": "核心脊柱",
  },
};

/**
 * The homepage's module map: one section per course module, chapters as
 * clickable nodes with a seamKind marker (◆ = capability seam, ○ = not a
 * seam, · = the deliberately non-mechanism core spine). This is the entire
 * homepage's visual anchor — not uniform flat-card presentation, just a
 * navigator by module with each chapter's seam truth labeled inline.
 */
export function ModuleMap({ locale, chapters }: { locale: Locale; chapters: Chapter[] }) {
  const modules = [...MODULES].sort((a, b) => a.order - b.order);
  const labels = KIND_LABEL[locale];
  return (
    <div className="space-y-10">
      {modules.map((mod) => {
        const chaptersInModule = chapters.filter((c) => c.module === mod.id);
        if (chaptersInModule.length === 0) return null;
        const classes = moduleClasses(mod.id);
        return (
          <section key={mod.id} className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className={cn("h-2 w-2 rounded-full", classes.dot)} />
              <h2 className="text-base font-semibold">{mod.title[locale]}</h2>
              <span className="text-xs text-[--color-text-faint]">{mod.description[locale]}</span>
            </div>
            <ul className="ml-4 grid gap-1.5 border-l-2 border-[--color-border] pl-5 sm:grid-cols-1">
              {chaptersInModule.map((chapter) => (
                <li key={chapter.slug} className="flex items-baseline gap-2">
                  <Link
                    href={`/${locale}/${chapter.slug}`}
                    className="text-sm text-[--color-text] transition-colors hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    {chapter.title}
                  </Link>
                  <span className="text-xs text-[--color-text-faint]" title={labels?.[chapter.seamKind]}>
                    {KIND_MARKER[chapter.seamKind]}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
