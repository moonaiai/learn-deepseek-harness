"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useDarkMode } from "@/hooks/use-dark-mode";

/**
 * Renders a single Mermaid diagram from its raw graph text. Used both by
 * {@link DocBody} (which finds `<code class="language-mermaid">` blocks
 * produced by the markdown pipeline and swaps them for this component) and
 * directly by pages that embed a diagram outside of Markdown.
 *
 * Mermaid needs a live DOM to lay out SVG, so this is a client-only island;
 * it re-renders whenever the resolved theme (dark/light) changes so diagram
 * colors track the site theme.
 */
export function MermaidDiagram({ chart }: { chart: string }) {
  const isDark = useDarkMode();
  const id = useId().replace(/:/g, "-");
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? "dark" : "default",
        securityLevel: "strict",
        fontFamily: "inherit",
      });
      try {
        const { svg } = await mermaid.render(`mermaid-${id}`, chart);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }
    void render();
    return () => {
      cancelled = true;
    };
  }, [chart, id, isDark]);

  if (error) {
    return (
      <pre className="overflow-x-auto rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400">
        Mermaid render error: {error}
      </pre>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-diagram my-6 flex justify-center overflow-x-auto rounded-lg border border-[--color-border] bg-[--color-surface] p-4"
    />
  );
}
