"use client";

import { useProgress } from "@/hooks/use-progress";
import { ProgressCheck } from "@/components/ui/progress-check";

export function ChapterProgressToggle({
  chapterId,
  completeLabel,
  incompleteLabel,
}: {
  chapterId: string;
  completeLabel: string;
  incompleteLabel: string;
}) {
  const { isCompleted, toggle } = useProgress();
  const done = isCompleted(chapterId);
  return (
    <ProgressCheck completed={done} onToggle={() => toggle(chapterId)} label={done ? incompleteLabel : completeLabel} />
  );
}
