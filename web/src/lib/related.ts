import type { Chapter, Locale } from "./types";
import { getModule } from "./modules";

/**
 * A thin client wrapper read from the course's content data (which module
 * this chapter belongs to, and which other chapters share that module —
 * used to build the "相关阅读" section). This is a deliberate, explicit
 * computation, not a guess at graph structure — the only meaningful "related
 * chapters" for this course are the ones on the same capability-seam topic
 * group, which is what the module id encodes.
 */
export function getRelatedChapters(locale: Locale, chapter: Chapter, all: Chapter[]): Chapter[] {
  const meta = getModule(chapter.module);
  const list = all.filter((c) => c.module === meta.id && c.slug !== chapter.slug);
  return list.sort((a, b) => a.order - b.order);
}
