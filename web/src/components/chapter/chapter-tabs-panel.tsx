"use client";

import { DocBody } from "@/components/docs/doc-body";
import { StepDiagram } from "@/components/diagram/step-diagram";
import { SeamSimulator } from "@/components/diagram/seam-simulator";
import { DesignDecisions } from "@/components/chapter/design-decisions";
import { SourceBadge } from "@/components/docs/source-badge";
import { Tabs } from "@/components/ui/tabs";
import type { ChapterShowcase } from "@/data/chapter-showcase";
import type { ChapterTabId, DesignDecision, Locale, SourceRef } from "@/lib/types";

export function ChapterTabsPanel({
  locale,
  chapterHtml,
  showcase,
  decisions,
  sources,
  availableTabs,
  readLabel,
  visualizeLabel,
  playLabel,
  deepDiveLabel,
  sourcesTitle,
}: {
  locale: Locale;
  chapterHtml: string;
  showcase?: ChapterShowcase;
  decisions: DesignDecision[];
  sources: SourceRef[];
  availableTabs: ChapterTabId[];
  readLabel: string;
  visualizeLabel: string;
  playLabel: string;
  deepDiveLabel: string;
  sourcesTitle: string;
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
          {activeTab === "deep-dive" && (
            <div className="space-y-6">
              <DesignDecisions decisions={decisions} locale={locale} />
              {sources.length > 0 ? (
                <section>
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[--color-text-faint]">
                    {sourcesTitle}
                  </h2>
                  <div className="flex flex-col gap-2">
                    {sources.map((source, i) => (
                      <SourceBadge key={`${source.path}-${i}`} source={source} />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </>
      )}
    </Tabs>
  );
}
