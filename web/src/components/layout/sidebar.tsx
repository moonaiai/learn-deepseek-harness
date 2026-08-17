"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import type { Chapter } from "@/lib/types";
import { useI18n } from "@/i18n/i18n-client";
import { MODULES } from "@/lib/modules";
import { moduleClasses } from "@/lib/modules";
import { useProgress } from "@/hooks/use-progress";
import { cn } from "@/lib/utils";

/**
 * The course outline, grouped by module (see `lib/modules.ts`). Renders
 * identically in the always-visible desktop rail and inside the mobile
 * header's collapsible panel — `variant` only changes the wrapping element,
 * not the content, so the two never drift apart.
 */
export function Sidebar({
  chapters,
  activeSlug,
  variant = "desktop",
}: {
  chapters: Chapter[];
  activeSlug?: string;
  variant?: "desktop" | "mobile";
}) {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const { isCompleted } = useProgress();
  const modules = [...MODULES].sort((a, b) => a.order - b.order);

  const content = (
    <nav className="space-y-6 text-sm">
      {modules.map((mod) => {
        const chaptersInModule = chapters.filter((c) => c.module === mod.id);
        if (chaptersInModule.length === 0) return null;
        const classes = moduleClasses(mod.id);
        return (
          <div key={mod.id}>
            <h3 className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-[--color-text-faint]">
              <span className={cn("h-1.5 w-1.5 rounded-full", classes.dot)} />
              {mod.title[locale]}
            </h3>
            <ul className="space-y-0.5">
              {chaptersInModule.map((chapter) => {
                const href = `/${locale}/${chapter.slug}`;
                const isActive = chapter.slug === activeSlug || pathname === href;
                const done = isCompleted(chapter.id);
                return (
                  <li key={chapter.slug}>
                    <Link
                      href={href}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors",
                        isActive
                          ? cn(classes.activeBg, "font-medium text-[--color-text]")
                          : "text-[--color-text-muted] hover:bg-[--color-surface-hover] hover:text-[--color-text]",
                      )}
                    >
                      {done ? (
                        <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                      ) : (
                        <Circle size={14} className="shrink-0 text-[--color-text-faint]" />
                      )}
                      <span className="truncate">{chapter.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  if (variant === "mobile") return content;

  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r border-[--color-border] px-4 py-6 lg:block">
      <p className="mb-4 px-1 text-xs font-semibold uppercase tracking-wide text-[--color-text-faint]">
        {t("sidebar.title")}
      </p>
      {content}
    </aside>
  );
}
