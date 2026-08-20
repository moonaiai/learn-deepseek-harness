import { notFound } from "next/navigation";
import { getTranslator } from "@/i18n/i18n-server";
import { getAllChapters, getChapter, getAdjacentChapters } from "@/lib/content";
import { getChapterShowcase } from "@/data/chapter-showcase";
import { getDesignDecisions } from "@/data/design-decisions";
import { ChapterAnchor } from "@/components/chapter/chapter-anchor";
import { ChapterPager } from "@/components/chapter/chapter-pager";
import { ChapterToc } from "@/components/chapter/chapter-toc";
import { DocBody } from "@/components/docs/doc-body";
import { DocSection } from "@/components/docs/doc-section";
import { SourceBadge } from "@/components/docs/source-badge";
import { StepDiagram } from "@/components/diagram/step-diagram";
import { SeamSimulator } from "@/components/diagram/seam-simulator";
import { DesignDecisions } from "@/components/chapter/design-decisions";
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
  const sources = chapter.sources;

  return (
    <div className="flex gap-10">
      <article className="min-w-0 max-w-3xl flex-1">
        <ChapterAnchor
          chapter={chapter}
          locale={resolvedLocale}
          completeLabel={t("chapter.markComplete")}
          incompleteLabel={t("chapter.markIncomplete")}
        />

        {/* Hero: the chapter's stepped mechanism diagram leads the page, so the
         * first thing seen is the interactive "run" visual, not prose. */}
        {showcase?.diagram ? (
          <div className="mb-10">
            <StepDiagram data={showcase.diagram} />
          </div>
        ) : null}

        {/* The chapter's prose is the primary content — it's the untitled
         * lead, not a tab, and never unmounts. */}
        <DocBody html={chapter.html} />

        {/* Remaining interactive/Deep-Dive sections follow the prose inline. */}
        {showcase?.simulator ? (
          <DocSection overtitle={t("section.play")}>
            <SeamSimulator scenario={showcase.simulator} />
          </DocSection>
        ) : null}

        {decisions.length > 0 || sources.length > 0 ? (
          <DocSection overtitle={t("section.deepDive")}>
            {decisions.length > 0 ? <DesignDecisions decisions={decisions} locale={resolvedLocale} /> : null}
            {sources.length > 0 ? (
              <div className="mt-8">
                <h3 className="mb-3 text-sm font-semibold text-[--color-text-muted]">
                  {t("chapter.sourcesTitle")}
                </h3>
                <div className="flex flex-col gap-2">
                  {sources.map((source, i) => (
                    <SourceBadge key={`${source.path}-${i}`} source={source} />
                  ))}
                </div>
              </div>
            ) : null}
          </DocSection>
        ) : null}

        <ChapterPager
          locale={resolvedLocale}
          prev={prev}
          next={next}
          prevLabel={t("chapter.prev")}
          nextLabel={t("chapter.next")}
        />
      </article>

      <ChapterToc entries={chapter.toc} title={t("chapter.onThisPage")} />
    </div>
  );
}
