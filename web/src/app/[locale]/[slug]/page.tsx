import { notFound } from "next/navigation";
import { getTranslator } from "@/i18n/i18n-server";
import { getAllChapters, getChapter, getAdjacentChapters } from "@/lib/content";
import { DocBody } from "@/components/docs/doc-body";
import { SourceBadge } from "@/components/docs/source-badge";
import { ModuleBadge } from "@/components/ui/module-badge";
import { MODULES } from "@/lib/modules";
import { ChapterProgressToggle } from "@/components/chapter/chapter-progress-toggle";
import { ChapterPager } from "@/components/chapter/chapter-pager";
import { TableOfContents } from "@/components/chapter/table-of-contents";
import { LOCALES, resolveLocale } from "@/lib/types";

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => getAllChapters(locale).map((chapter) => ({ locale, slug: chapter.slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: rawLocale, slug } = await params;
  const locale = resolveLocale(rawLocale);
  const chapter = getChapter(locale, slug);
  return { title: chapter ? `${chapter.title} · Learn DeepSeek Harness` : "Learn DeepSeek Harness" };
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = resolveLocale(rawLocale);
  const chapter = getChapter(locale, slug);
  if (!chapter) notFound();

  const t = getTranslator(locale);
  const { prev, next } = getAdjacentChapters(locale, slug);
  const moduleMeta = MODULES.find((m) => m.id === chapter.module);

  return (
    <div className="flex gap-10">
      <article className="min-w-0 flex-1">
        <header className="mb-8">
          {moduleMeta ? (
            <div className="mb-3">
              <ModuleBadge moduleId={chapter.module} label={moduleMeta.title[locale]} />
            </div>
          ) : null}
          <h1 className="text-3xl font-bold tracking-tight">{chapter.title}</h1>
          <p className="mt-3 text-[--color-text-muted]">{chapter.summary}</p>
          <div className="mt-4">
            <ChapterProgressToggle
              chapterId={chapter.id}
              completeLabel={t("chapter.markComplete")}
              incompleteLabel={t("chapter.markIncomplete")}
            />
          </div>
        </header>

        <DocBody html={chapter.html} />

        {chapter.sources && chapter.sources.length > 0 ? (
          <section className="mt-10 border-t border-[--color-border] pt-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[--color-text-faint]">
              {t("chapter.sourcesTitle")}
            </h2>
            <div className="flex flex-col gap-2">
              {chapter.sources.map((source, i) => (
                <SourceBadge key={`${source.path}-${i}`} source={source} />
              ))}
            </div>
          </section>
        ) : null}

        <ChapterPager locale={locale} prev={prev} next={next} prevLabel={t("chapter.prev")} nextLabel={t("chapter.next")} />
      </article>

      <TableOfContents toc={chapter.toc} title={t("chapter.onThisPage")} />
    </div>
  );
}
