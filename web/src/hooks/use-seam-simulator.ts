"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SeamStepType = "request" | "dispatch" | "provider_selected" | "provider_execute" | "result";

export interface SeamStep {
  type: SeamStepType;
  content: string;
  annotation: string;
  /** Name of the provider/backend this step concerns, shown as a label. */
  providerName?: string;
}

export interface SeamScenario {
  title: string;
  description: string;
  steps: SeamStep[];
}

interface SimulatorState {
  currentIndex: number;
  isPlaying: boolean;
  speed: number;
}

/**
 * Playback engine for {@link SeamSimulator}: a self-rescheduling `setTimeout`
 * chain (not `setInterval`) whose delay is `1200 / speed`, incrementing an
 * integer `currentIndex` that both gates `visibleSteps` (the reveal
 * mechanism — steps accumulate one at a time rather than all appearing at
 * once) and auto-stops playback once it reaches the last step.
 */
export function useSeamSimulator(steps: SeamStep[]) {
  const [state, setState] = useState<SimulatorState>({ currentIndex: -1, isPlaying: false, speed: 1 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stepForward = useCallback(() => {
    setState((prev) => {
      if (prev.currentIndex >= steps.length - 1) return { ...prev, isPlaying: false };
      return { ...prev, currentIndex: prev.currentIndex + 1 };
    });
  }, [steps.length]);

  const play = useCallback(() => {
    setState((prev) => (prev.currentIndex >= steps.length - 1 ? prev : { ...prev, isPlaying: true }));
  }, [steps.length]);

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: false }));
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    setState({ currentIndex: -1, isPlaying: false, speed: 1 });
  }, [clearTimer]);

  const setSpeed = useCallback((speed: number) => {
    setState((prev) => ({ ...prev, speed }));
  }, []);

  useEffect(() => {
    if (state.isPlaying && state.currentIndex < steps.length - 1) {
      const delay = 1200 / state.speed;
      timerRef.current = setTimeout(() => {
        stepForward();
      }, delay);
    } else if (state.isPlaying && state.currentIndex >= steps.length - 1) {
      setState((prev) => ({ ...prev, isPlaying: false }));
    }
    return () => clearTimer();
  }, [state.isPlaying, state.currentIndex, state.speed, steps.length, stepForward, clearTimer]);

  return {
    currentIndex: state.currentIndex,
    isPlaying: state.isPlaying,
    speed: state.speed,
    visibleSteps: steps.slice(0, state.currentIndex + 1),
    totalSteps: steps.length,
    isComplete: state.currentIndex >= steps.length - 1,
    play,
    pause,
    stepForward,
    reset,
    setSpeed,
  };
}
