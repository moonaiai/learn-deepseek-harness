"use client";

import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MermaidDiagram } from "./mermaid-diagram";

/**
 * Server-rendered chapter/doc HTML contains plain
 * `<pre><code class="language-mermaid">...</code></pre>` blocks (the
 * markdown pipeline does not special-case mermaid fences). This component
 * walks the rendered container after mount, replaces each one with a mounted
 * {@link MermaidDiagram} React root, and tears the roots down on unmount —
 * the one place in the app where we manually manage React roots outside
 * Next's own tree, because the HTML string boundary makes JSX substitution
 * impossible any other way.
 */
export function MermaidHydrator({ containerRef }: { containerRef: React.RefObject<HTMLElement | null> }) {
  const rootsRef = useRef<Root[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const blocks = Array.from(container.querySelectorAll("pre > code.language-mermaid"));
    const roots: Root[] = [];

    for (const block of blocks) {
      const pre = block.parentElement;
      if (!pre) continue;
      const chart = block.textContent ?? "";
      const mount = document.createElement("div");
      pre.replaceWith(mount);
      const root = createRoot(mount);
      root.render(<MermaidDiagram chart={chart} />);
      roots.push(root);
    }

    rootsRef.current = roots;
    return () => {
      for (const root of roots) root.unmount();
    };
  }, [containerRef]);

  return null;
}
