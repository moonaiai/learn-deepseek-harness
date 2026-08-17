import { ExternalLink } from "lucide-react";
import type { SourceRef } from "@/lib/types";
import { sourceUrl, sourceLines } from "@/lib/source-link";
import { cn } from "@/lib/utils";

/** A clickable badge linking to a precise line range in the anchored
 * deepseek-harness commit. Rendered above code-reference blocks and in the
 * per-chapter "Sources cited" list. */
export function SourceBadge({ source, className }: { source: SourceRef; className?: string }) {
  const lines = sourceLines(source);
  return (
    <a
      href={sourceUrl(source)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-[--color-border] bg-[--color-surface] px-2.5 py-1 font-mono text-xs text-[--color-text-muted] transition-colors hover:border-blue-500/50 hover:text-blue-600 dark:hover:text-blue-400",
        className,
      )}
    >
      <ExternalLink size={12} className="shrink-0" />
      <span className="truncate">
        {source.path}
        {lines ? `#${lines}` : ""}
      </span>
      {source.label ? <span className="text-[--color-text-faint]">· {source.label}</span> : null}
    </a>
  );
}
