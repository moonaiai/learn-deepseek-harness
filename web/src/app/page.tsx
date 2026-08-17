import { redirect } from "next/navigation";
import { DEFAULT_LOCALE } from "@/lib/types";

/** The bare domain root redirects to the default locale's home page; every
 * other page is reached through the `[locale]` segment. */
export default function RootPage() {
  redirect(`/${DEFAULT_LOCALE}/`);
}
