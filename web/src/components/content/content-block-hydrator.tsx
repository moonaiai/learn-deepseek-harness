"use client";

import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ConceptCard } from "./concept-card";
import { DecisionCard } from "./decision-card";
import { Timeline } from "./timeline";

/**
 * Middleware between the static `<div data-block="…">` elements the
 * `remarkContentBlocks` plugin emits and the React block components. Mirrors
 * `SourceViewerHydrator`'s approach exactly: after the server-rendered HTML is
 * mounted, walk the container for `[data-block]` markers, read the directive
 * attributes back off the `data-*` props, and `createRoot`-mount the matching
 * component in place — the existing inner HTML (the block's authored body)
 * becomes the component's children. Registered in `DocBody` alongside the
 * Mermaid and SourceViewer hydrators.
 *
 * `concept` and `decision` need hydration (attr ↔ children restructure) —
 * `timeline` needs the stepper state machine — but `fold` is a native
 * `<details>` element that needs only CSS, so it never reaches this hydrator.
 */
export function ContentBlockHydrator({ containerRef }: { containerRef: React.RefObject<HTMLElement | null> }) {
  const rootsRef = useRef<Root[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const blocks = Array.from(container.querySelectorAll("[data-block]"));
    const roots: Root[] = [];

    for (const block of blocks) {
      const kind = block.getAttribute("data-block");
      const html = block.innerHTML;
      let node: React.ReactNode = null;

      if (kind === "concept") {
        node = <ConceptCard term={block.getAttribute("data-term") ?? undefined} html={html} />;
      } else if (kind === "decision") {
        node = <DecisionCard html={html} />;
      } else if (kind === "timeline") {
        node = <Timeline html={html} />;
      }
      if (!node) continue;

      const mount = document.createElement("div");
      block.replaceWith(mount);
      const root = createRoot(mount);
      root.render(node);
      roots.push(root);
    }

    rootsRef.current = roots;
    return () => {
      for (const root of roots) root.unmount();
    };
  }, [containerRef]);

  return null;
}
