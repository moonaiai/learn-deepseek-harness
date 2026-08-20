"use client";

import type { Chapter } from "@/lib/types";
import { useProgress } from "@/hooks/use-progress";

/** Aggregate progress bar for the home page — counts completed chapters
 * against the full course length using the same localStorage-backed state
 * as the sidebar checkmarks and the per-chapter toggle. */
export function HomeProgress({ chapters, title }: { chapters: Chapter[]; title: string }) {
  const { completed } = useProgress();
  const total = chapters.length;
  const done = chapters.filter((c) => completed.has(c.id)).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-[--color-border] bg-[--color-surface] p-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium">{title}</span>
        <span className="text-[--color-text-muted]">
          {done} / {total}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[--color-surface-hover]">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
