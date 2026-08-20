import { GitBranch } from "lucide-react";

/**
 * Inline "we chose X over Y" block (`:::decision`), the in-flow counterpart to
 * the bottom-of-chapter Deep-Dive `DesignDecisions` cards. It carries the same
 * problem/decision/alternatives framing but sits exactly where the topic
 * arises in the prose, so the reasoning is visible in context rather than
 * quarantined at the end of the chapter.
 */
export function DecisionCard({ html }: { html: string }) {
  return (
    <div className="my-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
        <GitBranch size={13} />
        <span>Design decision</span>
      </div>
      <div className="decision-body text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
