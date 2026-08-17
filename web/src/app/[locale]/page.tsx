import Link from "next/link";
import { ArrowRight, GitCommitHorizontal, Map } from "lucide-react";
import { getTranslator } from "@/i18n/i18n-server";
import { getAllChapters } from "@/lib/content";
import { MODULES, moduleClasses } from "@/lib/modules";
import { Card } from "@/components/ui/card";
import { HomeProgress } from "@/components/home/home-progress";
import { SOURCE_COMMIT, SOURCE_REPO } from "@/lib/source-link";
import { LOCALES, resolveLocale } from "@/lib/types";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const t = getTranslator(locale);
  const chapters = getAllChapters(locale);
  const modules = [...MODULES].sort((a, b) => a.order - b.order);
  const firstChapter = chapters[0];

  return (
    <div className="mx-auto max-w-4xl">
      <section className="py-10 text-center sm:py-16">
        <p className="mb-3 text-sm font-medium text-blue-600 dark:text-blue-400">{t("home.kicker")}</p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("home.title")}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-[--color-text-muted]">{t("home.subtitle")}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {firstChapter ? (
            <Link
              href={`/${locale}/${firstChapter.slug}`}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
            >
              {t("home.cta")}
              <ArrowRight size={16} />
            </Link>
          ) : null}
          <Link
            href={`/${locale}/concept-map`}
            className="inline-flex items-center gap-2 rounded-lg border border-[--color-border] px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-[--color-surface-hover]"
          >
            <Map size={16} />
            {t("home.ctaSecondary")}
          </Link>
        </div>
        <p className="mt-6 inline-flex items-center gap-1.5 text-xs text-[--color-text-faint]">
          <GitCommitHorizontal size={13} />
          {t("home.anchorNote")}{" "}
          <a
            href={`https://github.com/${SOURCE_REPO}/tree/${SOURCE_COMMIT}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-blue-600 hover:underline dark:text-blue-400"
          >
            {SOURCE_COMMIT.slice(0, 7)}
          </a>
        </p>
      </section>

      <section className="mb-8">
        <HomeProgress locale={locale} chapters={chapters} title={t("home.progressTitle")} />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">{t("home.modulesTitle")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {modules.map((mod) => {
            const inModule = chapters.filter((c) => c.module === mod.id);
            const classes = moduleClasses(mod.id);
            return (
              <Card key={mod.id} className="flex flex-col">
                <div className="mb-2 flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${classes.dot}`} />
                  <h3 className="font-semibold">{mod.title[locale]}</h3>
                </div>
                <p className="mb-4 flex-1 text-sm text-[--color-text-muted]">{mod.description[locale]}</p>
                <ul className="space-y-1">
                  {inModule.map((chapter) => (
                    <li key={chapter.slug}>
                      <Link
                        href={`/${locale}/${chapter.slug}`}
                        className="text-sm text-[--color-text-muted] transition-colors hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {chapter.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
