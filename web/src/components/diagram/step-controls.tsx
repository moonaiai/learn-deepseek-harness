"use client";

import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";

export function StepControls({
  currentStep,
  totalSteps,
  isPlaying,
  onPrev,
  onNext,
  onToggleAutoPlay,
  onReset,
  onGoToStep,
  stepTitle,
  stepDesc,
}: {
  currentStep: number;
  totalSteps: number;
  isPlaying: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggleAutoPlay: () => void;
  onReset: () => void;
  onGoToStep: (step: number) => void;
  stepTitle?: string;
  stepDesc?: string;
}) {
  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="flex items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={onReset}
          aria-label="Reset"
          className="rounded-lg p-2 text-[--color-text-muted] transition-colors hover:bg-[--color-surface-hover] hover:text-[--color-text]"
        >
          <RotateCcw size={15} />
        </button>
        <button
          type="button"
          onClick={onPrev}
          disabled={currentStep === 0}
          aria-label="Previous step"
          className="rounded-lg p-2 text-[--color-text-muted] transition-colors hover:bg-[--color-surface-hover] hover:text-[--color-text] disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <SkipBack size={15} />
        </button>
        <button
          type="button"
          onClick={onToggleAutoPlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="rounded-lg bg-blue-600 p-2.5 text-white transition-colors hover:bg-blue-500"
        >
          {isPlaying ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={currentStep === totalSteps - 1}
          aria-label="Next step"
          className="rounded-lg p-2 text-[--color-text-muted] transition-colors hover:bg-[--color-surface-hover] hover:text-[--color-text] disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <SkipForward size={15} />
        </button>
      </div>

      <div className="flex items-center justify-center gap-1.5">
        {Array.from({ length: totalSteps }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onGoToStep(i)}
            aria-label={`Go to step ${i + 1}`}
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors",
              i === currentStep
                ? "bg-blue-500"
                : i < currentStep
                  ? "bg-blue-300 dark:bg-blue-800"
                  : "bg-[--color-border]",
            )}
          />
        ))}
      </div>

      {stepTitle || stepDesc ? (
        <div className="rounded-lg border border-[--color-border] bg-[--color-surface] px-4 py-2.5 text-center">
          {stepTitle ? <p className="text-sm font-semibold">{stepTitle}</p> : null}
          {stepDesc ? <p className="mt-0.5 text-xs text-[--color-text-muted]">{stepDesc}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
