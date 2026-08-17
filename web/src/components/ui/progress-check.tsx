"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProgressCheck({
  completed,
  onToggle,
  label,
}: {
  completed: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={completed}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
        completed
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-[--color-border] bg-[--color-surface] text-[--color-text-muted] hover:border-emerald-500/40 hover:text-emerald-600",
      )}
    >
      {completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}
      {label}
    </button>
  );
}
