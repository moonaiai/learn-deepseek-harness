"use client";

import { DocBody } from "@/components/docs/doc-body";
import { StepDiagram } from "@/components/diagram/step-diagram";
import { SeamSimulator } from "@/components/diagram/seam-simulator";
import { DesignDecisions } from "@/components/chapter/design-decisions";
import { Tabs } from "@/components/ui/tabs";
import type { ChapterShowcase } from "@/data/chapter-showcases";
import type { ChapterTabId, DesignDecision, Locale } from "@/lib/types";

export function ChapterTabsPanel({
  locale,
  chapterHtml,
  showcase,
  decisions,
  availableTabs,
  readLabel,
  visualizeLabel,
  playLabel,
  deepDiveLabel,
}: {
  locale: Locale;
  chapterHtml: string;
  showcase?: ChapterShowcase;
  decisions: DesignDecision[];
  availableTabs: ChapterTabId[];
  readLabel: string;
  visualizeLabel: string;
  playLabel: string;
  deepDiveLabel: string;
}) {
  const labelMap: Record<ChapterTabId, string> = {
    read: readLabel,
    visualize: visualizeLabel,
    play: playLabel,
    "deep-dive": deepDiveLabel,
  };

  const tabs = availableTabs.map((id) => ({ id, label: labelMap[id] }));

  return (
    <Tabs tabs={tabs} defaultTab="read">
      {(activeTab) => (
        <>
          {activeTab === "read" && <DocBody html={chapterHtml} />}
          {activeTab === "visualize" && showcase?.diagram && <StepDiagram data={showcase.diagram} />}
          {activeTab === "play" && showcase?.simulator && <SeamSimulator scenario={showcase.simulator} />}
          {activeTab === "deep-dive" && <DesignDecisions decisions={decisions} locale={locale} />}
        </>
      )}
    </Tabs>
  );
}
