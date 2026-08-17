import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[--color-border] bg-[--color-surface] p-5 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}
