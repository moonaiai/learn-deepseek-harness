"use client";

import { StepDiagram } from "@/components/diagram/step-diagram";
import { SeamSimulator } from "@/components/diagram/seam-simulator";
import type { ChapterShowcase } from "@/data/chapter-showcases";

/** Renders a chapter's optional {@link StepDiagram}/{@link SeamSimulator}
 * showcase, if `chapter-showcases.ts` has an entry for its slug. A thin
 * client wrapper so the (server) chapter page can pass the showcase data
 * down without itself becoming a client component. */
export function ChapterShowcasePanel({ showcase }: { showcase: ChapterShowcase }) {
  return (
    <>
      {showcase.diagram ? <StepDiagram data={showcase.diagram} /> : null}
      {showcase.simulator ? <SeamSimulator scenario={showcase.simulator} /> : null}
    </>
  );
}
