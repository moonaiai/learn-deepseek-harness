"use client";

import Link from "next/link";
import { useState } from "react";
import { Github, Menu, X } from "lucide-react";
import { useI18n } from "@/i18n/i18n-client";
import { ThemeToggle } from "./theme-toggle";
import { LocaleSwitcher } from "./locale-switcher";
import { CommandSearch } from "./command-search";
import { SITE_REPO_URL, SITE_TITLE, SITE_TITLE_ZH } from "@/lib/site";
import { Sidebar } from "./sidebar";
import type { Chapter } from "@/lib/types";

export function Header({ chapters, activeSlug }: { chapters: Chapter[]; activeSlug?: string }) {
  const { locale, t } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[--color-border] bg-[--color-bg]/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
        <button
          type="button"
          className="rounded-lg p-2 text-[--color-text-muted] hover:bg-[--color-surface-hover] lg:hidden"
          aria-label={t("nav.toggleSidebar")}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        <Link href={`/${locale}`} className="font-semibold tracking-tight">
          {locale === "zh" ? SITE_TITLE_ZH : SITE_TITLE}
        </Link>

        <nav className="ml-2 hidden items-center gap-4 text-sm text-[--color-text-muted] md:flex">
          <Link href={`/${locale}/glossary`} className="hover:text-[--color-text]">
            {t("nav.glossary")}
          </Link>
          <Link href={`/${locale}/concept-map`} className="hover:text-[--color-text]">
            {t("nav.conceptMap")}
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <CommandSearch locale={locale} placeholder={t("nav.searchPlaceholder")} />
          <LocaleSwitcher locale={locale} />
          <ThemeToggle label={t("nav.toggleTheme")} />
          <a
            href={SITE_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("nav.github")}
            className="rounded-lg p-2 text-[--color-text-muted] hover:bg-[--color-surface-hover] hover:text-[--color-text]"
          >
            <Github size={18} />
          </a>
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t border-[--color-border] px-4 py-3 lg:hidden">
          <Sidebar chapters={chapters} activeSlug={activeSlug} variant="mobile" />
        </div>
      ) : null}
    </header>
  );
}
