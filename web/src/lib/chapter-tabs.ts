import type { ChapterTabId } from "./types";
import { getChapterShowcase } from "@/data/chapter-showcase";
import { hasDesignDecisions } from "@/data/design-decisions";

/**
 * Which tabs a chapter actually shows, computed from whether that tab's data
 * exists — a tab with no data is simply not rendered (no empty panel, no
 * placeholder button). `read` always exists; `visualize`/`play` appear only
 * when the chapter's `showcase.json` has the corresponding data;
 * `deep-dive` appears when the chapter has design-decision entries (its
 * `decisions.json`) or a non-empty source list (its `sources.{locale}.json`).
 */
export function getAvailableTabs(slug: string, sourceCount: number): ChapterTabId[] {
  const tabs: ChapterTabId[] = ["read"];
  const showcase = getChapterShowcase(slug);
  if (showcase?.diagram) tabs.push("visualize");
  if (showcase?.simulator) tabs.push("play");
  if (hasDesignDecisions(slug) || sourceCount > 0) tabs.push("deep-dive");
  return tabs;
}
