"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { MESSAGES, resolveKey } from "./messages";
import type { Locale } from "@/lib/types";

interface I18nContextValue {
  locale: Locale;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<I18nContextValue>(() => {
    const messages = MESSAGES[locale];
    return { locale, t: (key: string) => resolveKey(messages, key) };
  }, [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within an I18nProvider");
  return ctx;
}
