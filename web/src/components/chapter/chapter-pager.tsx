import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Chapter, Locale } from "@/lib/types";

export function ChapterPager({
  locale,
  prev,
  next,
  prevLabel,
  nextLabel,
}: {
  locale: Locale;
  prev: Chapter | null;
  next: Chapter | null;
  prevLabel: string;
  nextLabel: string;
}) {
  if (!prev && !next) return null;
  return (
    <div className="mt-12 grid gap-3 border-t border-[--color-border] pt-6 sm:grid-cols-2">
      {prev ? (
        <Link
          href={`/${locale}/${prev.slug}`}
          className="group flex flex-col rounded-lg border border-[--color-border] p-4 transition-colors hover:border-blue-500/40"
        >
          <span className="mb-1 inline-flex items-center gap-1 text-xs text-[--color-text-faint]">
            <ArrowLeft size={12} />
            {prevLabel}
          </span>
          <span className="font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400">{prev.title}</span>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={`/${locale}/${next.slug}`}
          className="group flex flex-col rounded-lg border border-[--color-border] p-4 text-right transition-colors hover:border-blue-500/40 sm:col-start-2"
        >
          <span className="mb-1 inline-flex items-center justify-end gap-1 text-xs text-[--color-text-faint]">
            {nextLabel}
            <ArrowRight size={12} />
          </span>
          <span className="font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400">{next.title}</span>
        </Link>
      ) : null}
    </div>
  );
}
