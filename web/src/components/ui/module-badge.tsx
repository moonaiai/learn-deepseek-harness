import { cn } from "@/lib/utils";
import { moduleClasses } from "@/lib/modules";
import type { ModuleId } from "@/lib/types";

export function ModuleBadge({ moduleId, label }: { moduleId: ModuleId; label: string }) {
  const classes = moduleClasses(moduleId);
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", classes.chip)}>
      {label}
    </span>
  );
}
