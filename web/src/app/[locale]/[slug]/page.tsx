import { notFound } from "next/navigation";
import { getTranslator } from "@/i18n/i18n-server";
import { getAllChapters, getChapter, getAdjacentChapters } from "@/lib/content";
import { getAvailableTabs } from "@/lib/chapter-tabs";
import { getChapterShowcase } from "@/data/chapter-showcase";
import { getDesignDecisions } from "@/data/design-decisions";
import { getRelatedChapters } from "@/lib/related";
import { ChapterAnchor } from "@/components/chapter/chapter-anchor";
import { ChapterTabsPanel } from "@/components/chapter/chapter-tabs-panel";
import { ChapterPager } from "@/components/chapter/chapter-pager";
import { RelatedChapters } from "@/components/chapter/related-chapters";
import { LOCALES, resolveLocale } from "@/lib/types";

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => getAllChapters(locale).map((chapter) => ({ locale, slug: chapter.slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const chapter = getChapter(resolveLocale(locale), slug);
  return { title: chapter ? `${chapter.title} · Learn DeepSeek Harness` : "Learn DeepSeek Harness" };
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const resolvedLocale = resolveLocale(locale);
  const chapter = getChapter(resolvedLocale, slug);
  if (!chapter) notFound();

  const t = getTranslator(resolvedLocale);
  const { prev, next } = getAdjacentChapters(resolvedLocale, slug);
  const showcase = getChapterShowcase(slug);
  const decisions = getDesignDecisions(slug);
  const availableTabs = getAvailableTabs(slug, chapter.sources.length);
  const all = getAllChapters(resolvedLocale);
  const related = getRelatedChapters(resolvedLocale, chapter, all);

  return (
    <div className="flex gap-10">
      <article className="min-w-0 flex-1">
        <ChapterAnchor
          chapter={chapter}
          locale={resolvedLocale}
          completeLabel={t("chapter.markComplete")}
          incompleteLabel={t("chapter.markIncomplete")}
        />

        <ChapterTabsPanel
          locale={resolvedLocale}
          chapterHtml={chapter.html}
          showcase={showcase}
          decisions={decisions}
          sources={chapter.sources}
          availableTabs={availableTabs}
          readLabel={t("tabs.read")}
          visualizeLabel={t("tabs.visualize")}
          playLabel={t("tabs.play")}
          deepDiveLabel={t("tabs.deepDive")}
          sourcesTitle={t("chapter.sourcesTitle")}
        />

        <ChapterPager
          locale={resolvedLocale}
          prev={prev}
          next={next}
          prevLabel={t("chapter.prev")}
          nextLabel={t("chapter.next")}
        />
      </article>

      <RelatedChapters locale={resolvedLocale} chapters={related} title={t("chapter.relatedChaptersTitle")} />
    </div>
  );
}
