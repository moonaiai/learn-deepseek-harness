/** Server Component translation helper — no React context, just a plain function
 * bound to one locale. See {@link "./i18n-client"} for the Client Component hook. */
import { MESSAGES, resolveKey } from "./messages";
import type { Locale } from "@/lib/types";

export function getTranslator(locale: Locale) {
  const messages = MESSAGES[locale];
  return (key: string) => resolveKey(messages, key);
}
