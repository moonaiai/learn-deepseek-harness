import { motion } from "motion/react";
import { ArrowRightLeft, GitBranch, MessageSquare, Send, Server } from "lucide-react";
import type { SeamStep } from "@/hooks/use-seam-simulator";
import { cn } from "@/lib/utils";

const TYPE_CONFIG: Record<
  SeamStep["type"],
  { icon: typeof Send; label: string; bgClass: string; borderClass: string }
> = {
  request: {
    icon: Send,
    label: "Request",
    bgClass: "bg-blue-50 dark:bg-blue-950/30",
    borderClass: "border-blue-200 dark:border-blue-800",
  },
  dispatch: {
    icon: ArrowRightLeft,
    label: "Dispatch",
    bgClass: "bg-zinc-50 dark:bg-zinc-900",
    borderClass: "border-zinc-200 dark:border-zinc-700",
  },
  provider_selected: {
    icon: GitBranch,
    label: "Provider selected",
    bgClass: "bg-amber-50 dark:bg-amber-950/30",
    borderClass: "border-amber-200 dark:border-amber-800",
  },
  provider_execute: {
    icon: Server,
    label: "Provider execute",
    bgClass: "bg-purple-50 dark:bg-purple-950/30",
    borderClass: "border-purple-200 dark:border-purple-800",
  },
  result: {
    icon: MessageSquare,
    label: "Result",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/30",
    borderClass: "border-emerald-200 dark:border-emerald-800",
  },
};

export function SimulatorMessage({ step }: { step: SeamStep; index: number }) {
  const config = TYPE_CONFIG[step.type];
  const Icon = config.icon;
  const isCodeLike = step.type === "dispatch" || step.type === "provider_execute";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("rounded-lg border p-3", config.bgClass, config.borderClass)}
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[--color-text-muted]">
        <Icon size={13} />
        <span>{config.label}</span>
        {step.providerName ? (
          <span className="rounded bg-[--color-surface] px-1.5 py-0.5 font-mono text-[10px]">{step.providerName}</span>
        ) : null}
      </div>
      {isCodeLike ? (
        <pre className="overflow-x-auto rounded bg-zinc-900 p-2 font-mono text-xs text-zinc-100 dark:bg-zinc-950">
          {step.content || "(empty)"}
        </pre>
      ) : (
        <p className="text-sm leading-relaxed">{step.content}</p>
      )}
      {step.annotation ? <p className="mt-1.5 text-xs italic text-[--color-text-faint]">{step.annotation}</p> : null}
    </motion.div>
  );
}
