import type { Metadata } from "next";
import { I18nProvider } from "@/i18n/i18n-client";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { getAllChapters } from "@/lib/content";
import { LOCALES, resolveLocale } from "@/lib/types";
import "../globals.css";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  return {
    title: locale === "zh" ? "深入 DeepSeek Harness" : "Learn DeepSeek Harness",
  };
}

/** Blocking inline script that applies the persisted (or system-preferred)
 * theme to `<html>` before first paint, avoiding a flash of the wrong theme.
 * Mirrors the pattern learn-claude-code uses for the same reason. */
const THEME_BOOT_SCRIPT = `
(function () {
  try {
    var stored = window.localStorage.getItem("theme");
    var dark = stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const chapters = getAllChapters(locale);

  return (
    <html lang={locale === "zh" ? "zh-CN" : "en"} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="antialiased">
        <I18nProvider locale={locale}>
          <Header chapters={chapters} />
          <div className="mx-auto flex max-w-7xl">
            <Sidebar chapters={chapters} />
            <main className="min-w-0 flex-1 px-4 py-8 lg:px-10">{children}</main>
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
