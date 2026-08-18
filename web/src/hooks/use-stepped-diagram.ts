"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface SteppedDiagramOptions {
  totalSteps: number;
  /** Milliseconds between auto-play advances. */
  autoPlayInterval?: number;
}

export interface SteppedDiagramState {
  currentStep: number;
  totalSteps: number;
  isPlaying: boolean;
  isFirstStep: boolean;
  isLastStep: boolean;
  next: () => void;
  prev: () => void;
  reset: () => void;
  goToStep: (step: number) => void;
  toggleAutoPlay: () => void;
}

/**
 * A minimal, domain-agnostic step-index state machine driving every
 * {@link StepDiagram}: bounded increment/decrement plus a `setInterval`-based
 * autoplay that stops itself once it reaches the last step. Carries no
 * knowledge of what a "step" means — callers index their own node/edge
 * activation tables by `currentStep`.
 */
export function useSteppedDiagram({
  totalSteps,
  autoPlayInterval = 2200,
}: SteppedDiagramOptions): SteppedDiagramState {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const next = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
  }, [totalSteps]);

  const prev = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const reset = useCallback(() => {
    setCurrentStep(0);
    setIsPlaying(false);
  }, []);

  const goToStep = useCallback(
    (step: number) => {
      setCurrentStep(Math.max(0, Math.min(step, totalSteps - 1)));
    },
    [totalSteps],
  );

  const toggleAutoPlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= totalSteps - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, autoPlayInterval);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, totalSteps, autoPlayInterval]);

  return {
    currentStep,
    totalSteps,
    isPlaying,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === totalSteps - 1,
    next,
    prev,
    reset,
    goToStep,
    toggleAutoPlay,
  };
}
