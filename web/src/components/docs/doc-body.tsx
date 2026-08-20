"use client";

import { useRef } from "react";
import { MermaidHydrator } from "@/components/diagram/mermaid-hydrator";
import { SourceViewerHydrator } from "@/components/code/source-viewer-hydrator";
import { ContentBlockHydrator } from "@/components/content/content-block-hydrator";

/**
 * Renders pre-built chapter/doc HTML (produced server-side by
 * `lib/markdown.ts` at build time) and hydrates any embedded Mermaid code
 * fences or `filename="..."` source excerpts in place. This is the only
 * place `dangerouslySetInnerHTML` is used in the app — the HTML source is
 * our own Markdown content, not user input.
 */
export function DocBody({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <>
      <div className="prose-course" ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
      <MermaidHydrator containerRef={ref} />
      <SourceViewerHydrator containerRef={ref} />
      <ContentBlockHydrator containerRef={ref} />
    </>
  );
}
