import { notFound } from "next/navigation";
import { getTranslator } from "@/i18n/i18n-server";
import { getDoc } from "@/lib/content";
import { DocBody } from "@/components/docs/doc-body";
import { LOCALES, resolveLocale } from "@/lib/types";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function GlossaryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const t = getTranslator(locale);
  const doc = getDoc(locale, "glossary");
  if (!doc) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t("glossary.title")}</h1>
        <p className="mt-3 text-[--color-text-muted]">{t("glossary.subtitle")}</p>
      </header>
      <DocBody html={doc.html} />
    </div>
  );
}
