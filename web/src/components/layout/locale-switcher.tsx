"use client";

import { usePathname, useRouter } from "next/navigation";
import type { Locale } from "@/lib/types";
import { LOCALES } from "@/lib/types";

/** Swaps the leading `/zh/` or `/en/` path segment and does a soft client
 * navigation to the equivalent page in the other locale — content pages for
 * both locales are statically generated at the same paths, only the
 * segment differs, so this is a plain string substitution, not a redirect. */
export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const router = useRouter();

  function switchTo(next: Locale) {
    if (next === locale) return;
    const rest = pathname.replace(/^\/(zh|en)/, "");
    router.push(`/${next}${rest || "/"}`);
  }

  return (
    <div className="flex items-center overflow-hidden rounded-lg border border-[--color-border] text-sm">
      {LOCALES.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => switchTo(loc)}
          className={
            loc === locale
              ? "bg-[--color-surface-hover] px-2.5 py-1 font-medium text-[--color-text]"
              : "px-2.5 py-1 text-[--color-text-muted] hover:text-[--color-text]"
          }
        >
          {loc === "zh" ? "中文" : "EN"}
        </button>
      ))}
    </div>
  );
}
