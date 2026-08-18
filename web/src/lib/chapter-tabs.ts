import type { ChapterTabId } from "./types";
import { getChapterShowcase } from "@/data/chapter-showcases";
import { hasDesignDecisions } from "@/data/design-decisions";

/**
 * Which tabs a chapter actually shows, computed from whether that tab's data
 * exists — a tab with no data is simply not rendered (no empty panel, no
 * placeholder button). `read` and `deep-dive` are universal (every chapter
 * has prose body and at least one design-decision entry); `visualize` and
 * `play` are flagship-only and appear only when `chapter-showcases.ts` has
 * the corresponding data for that slug.
 */
export function getAvailableTabs(slug: string): ChapterTabId[] {
  const tabs: ChapterTabId[] = ["read"];
  const showcase = getChapterShowcase(slug);
  if (showcase?.diagram) tabs.push("visualize");
  if (showcase?.simulator) tabs.push("play");
  if (hasDesignDecisions(slug)) tabs.push("deep-dive");
  return tabs;
}
