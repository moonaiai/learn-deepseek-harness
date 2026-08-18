"use client";

import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SourceViewer } from "./source-viewer";

/**
 * Mirrors `MermaidHydrator`'s approach: server-rendered chapter HTML
 * contains plain `<pre><code data-filename="...">...</code></pre>` blocks
 * wherever a fenced code block used `filename="..."` meta (see
 * `remark-source-viewer-meta.ts`). This walks the rendered container after
 * mount, replaces each one with a mounted `SourceViewer` React root (reusing
 * the block's already-highlighted inner HTML from rehype-highlight), and
 * tears the roots down on unmount.
 */
export function SourceViewerHydrator({ containerRef }: { containerRef: React.RefObject<HTMLElement | null> }) {
  const rootsRef = useRef<Root[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const blocks = Array.from(container.querySelectorAll("pre > code[data-filename]"));
    const roots: Root[] = [];

    for (const block of blocks) {
      const pre = block.parentElement;
      if (!pre) continue;
      const filename = block.getAttribute("data-filename") ?? "";
      const highlightedHtml = block.innerHTML;
      const lineCount = (block.textContent ?? "").split("\n").length;
      const mount = document.createElement("div");
      pre.replaceWith(mount);
      const root = createRoot(mount);
      root.render(<SourceViewer highlightedHtml={highlightedHtml} filename={filename} lineCount={lineCount} />);
      roots.push(root);
    }

    rootsRef.current = roots;
    return () => {
      for (const root of roots) root.unmount();
    };
  }, [containerRef]);

  return null;
}
