import { Terminal } from "lucide-react";

/**
 * Inline vocabulary block: a defined term lifted out of the prose into a
 * labelled card (`:::concept{term="…"}`). The term itself becomes a monospace
 * badge; the authored body (definition, occasionally a source chip) renders
 * beneath it. This is how a dense "term-defined-in-passing" sentence stops
 * being part of the wall of text.
 */
export function ConceptCard({ term, html }: { term?: string; html: string }) {
  return (
    <div className="my-6 rounded-xl border border-[--color-border] bg-[--color-surface] p-4">
      <div className="mb-2 flex items-center gap-2">
        <Terminal size={14} className="shrink-0 text-blue-500" />
        {term ? (
          <span className="rounded bg-blue-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20">
            {term}
          </span>
        ) : null}
      </div>
      <div
        className="concept-body text-sm leading-relaxed text-[--color-text-muted]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
