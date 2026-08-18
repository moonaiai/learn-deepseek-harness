import fs from "node:fs";
import path from "node:path";
import type { DesignDecision } from "@/lib/types";

/**
 * Per-chapter Deep-Dive design decisions, keyed by chapter slug. One JSON
 * file per chapter under `src/data/design-decisions/` (not one giant
 * registry) so different chapters' decision data can be authored in parallel
 * without touching a shared file. Read directly from disk at build time
 * (Node-only: called from Server Components and from
 * `scripts/build-search-index.ts`, never from a "use client" module), exactly
 * like `lib/content.ts` reads chapter markdown.
 *
 * Each entry is distilled from the corresponding Agent Note in the
 * deepseek-harness repository (`.agents/notes/implemented/architecture/` or
 * `feature/`), preserving its own Problem/Decision/Alternatives-considered
 * structure — the "why was it built this way, and what else was considered"
 * record, not a retelling of the chapter's prose.
 */
const DECISIONS_ROOT = path.join(process.cwd(), "src", "data", "design-decisions");

let cache: Map<string, DesignDecision[]> | null = null;

function loadAll(): Map<string, DesignDecision[]> {
  if (cache) return cache;
  const map = new Map<string, DesignDecision[]>();
  if (!fs.existsSync(DECISIONS_ROOT)) return map;
  for (const file of fs.readdirSync(DECISIONS_ROOT).filter((f) => f.endsWith(".json"))) {
    const slug = path.basename(file, ".json");
    const raw = JSON.parse(fs.readFileSync(path.join(DECISIONS_ROOT, file), "utf8")) as {
      decisions?: DesignDecision[];
    };
    map.set(slug, raw.decisions ?? []);
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
