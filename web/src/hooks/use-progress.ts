"use client";

import { useEffect, useState } from "react";
import { getCompletedIds, toggleCompleted, PROGRESS_EVENT } from "@/lib/progress";

/** Reactive view over the localStorage-backed completed-chapter set (see
 * `lib/progress.ts`); re-reads on the same-tab `PROGRESS_EVENT` so multiple
 * components (sidebar checkmarks, the chapter toggle button, the home page
 * progress bar) stay in sync without prop drilling. */
export function useProgress() {
  const [completed, setCompletedState] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setCompletedState(getCompletedIds());
    const handler = () => setCompletedState(getCompletedIds());
    window.addEventListener(PROGRESS_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(PROGRESS_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  function toggle(id: string) {
    const next = toggleCompleted(id);
    setCompletedState(next);
    window.dispatchEvent(new Event(PROGRESS_EVENT));
  }

  return { completed, toggle, isCompleted: (id: string) => completed.has(id) };
}
