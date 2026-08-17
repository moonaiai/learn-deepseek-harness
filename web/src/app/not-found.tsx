import Link from "next/link";
import { DEFAULT_LOCALE } from "@/lib/types";

/** Root not-found for paths outside the `[locale]` segment (e.g. a stray
 * `/foo` at the domain root). Locale-scoped 404s fall through to Next's
 * default not-found rendering inside `[locale]/layout.tsx`'s chrome. */
export default function NotFound() {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white text-slate-900">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <Link href={`/${DEFAULT_LOCALE}/`} className="text-blue-600 underline">
          Go home
        </Link>
      </body>
    </html>
  );
}
