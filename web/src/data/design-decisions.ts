import fs from "node:fs";
import path from "node:path";
import type { DesignDecision } from "@/lib/types";

/**
 * Per-chapter Deep-Dive design decisions, keyed by chapter slug, read from
 * the chapter's own `decisions.json` inside its data package under
 * `content/chapters/sNN-slug/` (one file per chapter, so different chapters'
 * decision data can be authored in parallel without touching a shared
 * registry). Read directly from disk at build time (Node-only: called from
 * Server Components and from `scripts/build-search-index.ts`, never from a
 * "use client" module), exactly like `lib/content.ts` reads chapter
 * markdown.
 *
 * Each entry is distilled from the corresponding Agent Note in the
 * deepseek-harness repository (`.agents/notes/implemented/architecture/` or
 * `feature/`), preserving its own Problem/Decision/Alternatives-considered
 * structure — the "why was it built this way, and what else was considered"
 * record, not a retelling of the chapter's prose.
 */
const CHAPTERS_ROOT = path.join(process.cwd(), "..", "content", "chapters");

let cache: Map<string, DesignDecision[]> | null = null;

function loadAll(): Map<string, DesignDecision[]> {
  if (cache) return cache;
  const map = new Map<string, DesignDecision[]>();
  if (!fs.existsSync(CHAPTERS_ROOT)) return map;
  for (const entry of fs.readdirSync(CHAPTERS_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const decisionsPath = path.join(CHAPTERS_ROOT, entry.name, "decisions.json");
    if (!fs.existsSync(decisionsPath)) continue;
    const raw = JSON.parse(fs.readFileSync(decisionsPath, "utf8")) as {
      decisions?: DesignDecision[];
    };
    if (raw.decisions && raw.decisions.length > 0) map.set(entry.name, raw.decisions);
  }
  cache = map;
  return map;
}

export function hasDesignDecisions(slug: string): boolean {
  return loadAll().has(slug);
}

export function getDesignDecisions(slug: string): DesignDecision[] {
  return loadAll().get(slug) ?? [];
}
