"use client";

import { useMemo } from "react";
import { useSteppedDiagram } from "@/hooks/use-stepped-diagram";
import { StepControls } from "@/components/diagram/step-controls";
import { cn } from "@/lib/utils";

interface TimelineStep {
  title: string;
  desc: string;
}

/**
 * A caption-synced, step-through "run" for a *text* process (`:::timeline`) —
 * the learn-claude-code interaction the course needed. It parses the block's
 * authored ordered list into steps (each `<li>` becomes one step; an ` — ` or
 * `: ` split separates the step's title from its caption), then drives a
 * vertical stepper with the shared `useSteppedDiagram` state machine and the
 * standard `StepControls` transport. Advancing the step highlights the current
 * stage and syncs the caption beneath — so the reader *runs* the process
 * (append → validate → commit → notify) instead of reading it as one unbroken
 * paragraph.
 *
 * The authored HTML is the source of truth; if there is no list, the block is
 * a no-op aside and the stepper renders nothing.
 */
function parseSteps(html: string): TimelineStep[] {
  if (typeof document === "undefined") return [];
  const el = document.createElement("div");
  el.innerHTML = html;
  const items = Array.from(el.querySelectorAll("li"));
  return items.map((li) => {
    const text = li.textContent ?? "";
    const split = /^([^—:]+)[—:]\s*(.+)$/.exec(text.trim());
    return split ? { title: split[1].trim(), desc: split[2].trim() } : { title: text.trim(), desc: "" };
  });
}

export function Timeline({ html }: { html: string }) {
  const steps = useMemo(() => parseSteps(html), [html]);
  const diagram = useSteppedDiagram({ totalSteps: Math.max(steps.length, 1) });
  const current = steps[diagram.currentStep];

  if (steps.length === 0) return null;

  return (
    <div className="my-6 rounded-xl border border-[--color-border] bg-[--color-surface] p-4">
      <ol className="space-y-2">
        {steps.map((step, i) => {
          const active = i === diagram.currentStep;
          const done = i < diagram.currentStep;
          return (
            <li key={i} className="flex gap-3">
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors",
                  active
                    ? "border-blue-500 bg-blue-500 text-white"
                    : done
                      ? "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      : "border-[--color-border] text-[--color-text-faint]",
                )}
              >
                {i + 1}
              </span>
              <button
                type="button"
                onClick={() => diagram.goToStep(i)}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-left transition-colors",
                  active
                    ? "border-blue-500/50 bg-blue-500/5"
                    : "border-transparent hover:bg-[--color-surface-hover]",
                )}
              >
                <p className={cn("text-sm font-medium", active ? "text-[--color-text]" : "text-[--color-text-muted]")}>
                  {step.title}
                </p>
                {step.desc ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-[--color-text-faint]">{step.desc}</p>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>

      <StepControls
        currentStep={diagram.currentStep}
        totalSteps={diagram.totalSteps}
        isPlaying={diagram.isPlaying}
        onPrev={diagram.prev}
        onNext={diagram.next}
        onToggleAutoPlay={diagram.toggleAutoPlay}
        onReset={diagram.reset}
        onGoToStep={diagram.goToStep}
        stepTitle={current?.title}
        stepDesc={current?.desc}
      />
    </div>
  );
}
