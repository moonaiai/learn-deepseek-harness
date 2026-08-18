"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Tab {
  id: string;
  label: string;
}

/**
 * A minimal render-prop tab bar: owns a single `activeTab` string in local
 * state and calls `children(activeTab)` to let the parent decide what to
 * render per tab. There is no URL state, no router involvement, and no
 * re-fetch on switch — every tab's content is already rendered client-side,
 * so an inactive tab's component is unmounted (not hidden) and any local
 * state inside it (e.g. a simulator's playhead) resets on re-enter. This is
 * deliberate for a reading page: tabs are progressive disclosure within one
 * statically-generated page, not separate routes.
 */
export function Tabs({
  tabs,
  defaultTab,
  children,
}: {
  tabs: Tab[];
  defaultTab: string;
  children: (activeTab: string) => ReactNode;
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto border-b border-[--color-border]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "border-b-2 border-[--color-text] text-[--color-text]"
                : "text-[--color-text-muted] hover:text-[--color-text]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="pt-6">{children(activeTab)}</div>
    </div>
  );
}
