import type { Chapter, Locale } from "@/lib/types";
import { MODULES } from "@/lib/modules";
import { ModuleBadge } from "@/components/ui/module-badge";
import { ChapterProgressToggle } from "@/components/chapter/chapter-progress-toggle";

const KIND_LABEL: Record<Chapter["seamKind"], Record<Locale, string>> = {
  seam: { en: "capability seam", zh: "能力接缝" },
  "non-seam": { en: "not a capability seam", zh: "并非能力接缝" },
  "non-mechanism": { en: "core spine, not a seam", zh: "核心脊柱,非接缝机制" },
};

/**
 * The per-chapter visual anchor: module badge plus a clear statement about
 * whether this chapter's subject is actually a capability seam (from the
 * chapter's `seamKind` frontmatter field, which is checked afresh rather
 * than inferred from module id — the course's whole point is that not every
 * mechanism is a seam, and the anchor says so explicitly).
 */
export function ChapterAnchor({
  chapter,
  locale,
  completeLabel,
  incompleteLabel,
}: {
  chapter: Chapter;
  locale: Locale;
  completeLabel: string;
  incompleteLabel: string;
}) {
  const moduleMeta = MODULES.find((m) => m.id === chapter.module);
  const kindLabel = KIND_LABEL[chapter.seamKind][locale];

  return (
    <header className="mb-8 border-b border-[--color-border] pb-8">
      {moduleMeta ? (
        <div className="mb-2 flex items-center gap-2">
          <ModuleBadge moduleId={chapter.module} label={moduleMeta.title[locale]} />
          <span className="text-xs text-[--color-text-faint]">· {kindLabel}</span>
        </div>
      ) : null}
      <h1 className="text-3xl font-bold tracking-tight">{chapter.title}</h1>
      <p className="mt-3 max-w-2xl text-[--color-text-muted]">{chapter.summary}</p>
      <div className="mt-4">
        <ChapterProgressToggle
          chapterId={chapter.id}
          completeLabel={completeLabel}
          incompleteLabel={incompleteLabel}
        />
      </div>
    </header>
  );
}
