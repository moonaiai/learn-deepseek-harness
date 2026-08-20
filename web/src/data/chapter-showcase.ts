import fs from "node:fs";
import path from "node:path";
import type { StepDiagramData } from "@/components/diagram/step-diagram";
import type { SeamScenario } from "@/hooks/use-seam-simulator";

/**
 * Per-chapter StepDiagram/SeamSimulator data, keyed by chapter slug, read
 * from the chapter's own `showcase.json` inside its data package under
 * `content/chapters/sNN-slug/`. Only a handful of chapters have this file —
 * consumers treat absence as "no showcase data for that tab" (see
 * `lib/chapter-tabs.ts`). Read directly from disk at build time (Node-only),
 * exactly like `lib/content.ts` reads chapter markdown.
 *
 * Every node label, event name, and provider name inside a showcase entry
 * must be traceable to the corresponding chapter's own citations — this is
 * illustrative UI data, not a place to invent facts.
 */
export interface ChapterShowcase {
  diagram?: StepDiagramData;
  simulator?: SeamScenario;
}

const CHAPTERS_ROOT = path.join(process.cwd(), "..", "content", "chapters");

let cache: Map<string, ChapterShowcase> | null = null;

function loadAll(): Map<string, ChapterShowcase> {
  if (cache) return cache;
  const map = new Map<string, ChapterShowcase>();
  if (!fs.existsSync(CHAPTERS_ROOT)) return map;
  for (const entry of fs.readdirSync(CHAPTERS_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const showcasePath = path.join(CHAPTERS_ROOT, entry.name, "showcase.json");
    if (!fs.existsSync(showcasePath)) continue;
    const raw = JSON.parse(fs.readFileSync(showcasePath, "utf8")) as ChapterShowcase;
    if (raw && (raw.diagram || raw.simulator)) map.set(entry.name, raw);
  }
  cache = map;
  return map;
}

export function getChapterShowcase(slug: string): ChapterShowcase | undefined {
  return loadAll().get(slug);
}

export function hasChapterShowcase(slug: string): boolean {
  return loadAll().has(slug);
}
