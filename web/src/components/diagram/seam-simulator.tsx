"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence } from "motion/react";
import { useSeamSimulator, type SeamScenario } from "@/hooks/use-seam-simulator";
import { SimulatorControls } from "./simulator-controls";
import { SimulatorMessage } from "./simulator-message";

/**
 * A replayable timeline of a capability seam in action — e.g. one `bash`
 * tool call being dispatched to whichever shell provider (local vs.
 * sandboxed) is currently mounted. Playback is entirely client-side and
 * driven by {@link useSeamSimulator}; the scenario itself is static data
 * supplied per chapter (see `data/chapter-showcases.ts`).
 */
export function SeamSimulator({ scenario }: { scenario: SeamScenario }) {
  const sim = useSeamSimulator(scenario.steps);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [sim.visibleSteps.length]);

  return (
    <div className="my-6 overflow-hidden rounded-xl border border-[--color-border] bg-[--color-surface]">
      <div className="border-b border-[--color-border] px-4 py-3">
        <p className="text-sm font-semibold">{scenario.title}</p>
        <p className="text-xs text-[--color-text-muted]">{scenario.description}</p>
      </div>

      <div ref={scrollRef} className="max-h-80 space-y-2 overflow-y-auto p-3">
        {sim.visibleSteps.length === 0 ? (
          <p className="py-8 text-center text-sm text-[--color-text-faint]">Press play to start the replay.</p>
        ) : (
          <AnimatePresence mode="popLayout">
            {sim.visibleSteps.map((step, i) => (
              <SimulatorMessage key={i} step={step} index={i} />
            ))}
          </AnimatePresence>
        )}
      </div>

      <SimulatorControls
        isPlaying={sim.isPlaying}
        speed={sim.speed}
        isComplete={sim.isComplete}
        onPlay={sim.play}
        onPause={sim.pause}
        onReset={sim.reset}
        onSetSpeed={sim.setSpeed}
      />
    </div>
  );
}
