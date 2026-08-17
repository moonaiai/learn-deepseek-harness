import type { SourceRef } from "./types";

/**
 * The deepseek-harness commit every source link is anchored to. Pinning to a
 * fixed SHA (rather than `master`) keeps line-number links from silently
 * drifting out of sync with the prose that quotes them.
 */
export const SOURCE_COMMIT = "47f943859bef60e4160492346772ded9b24f765a";
export const SOURCE_REPO = "deepseek-ai/deepseek-harness";

/** Builds a GitHub blob URL for a source reference, anchored to {@link SOURCE_COMMIT}. */
export function sourceUrl(ref: SourceRef): string {
  const base = `https://github.com/${SOURCE_REPO}/blob/${SOURCE_COMMIT}/${ref.path}`;
  if (ref.lineStart == null) return base;
  const lines =
    ref.lineEnd != null && ref.lineEnd !== ref.lineStart
      ? `#L${ref.lineStart}-L${ref.lineEnd}`
      : `#L${ref.lineStart}`;
  return base + lines;
}

/** Human-readable line-range suffix, e.g. "L12-L40" or "L12". */
export function sourceLines(ref: SourceRef): string | null {
  if (ref.lineStart == null) return null;
  return ref.lineEnd != null && ref.lineEnd !== ref.lineStart
    ? `L${ref.lineStart}-L${ref.lineEnd}`
    : `L${ref.lineStart}`;
}
