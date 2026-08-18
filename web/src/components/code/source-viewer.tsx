interface SourceViewerProps {
  /** Pre-highlighted inner HTML from rehype-highlight (the same TS/JS token
   * spans used everywhere else in the app) — not raw text. */
  highlightedHtml: string;
  filename: string;
  /** Line count for the gutter, computed by the hydrator from the code
   * element's `textContent` (reliable) rather than guessed by splitting the
   * HTML string here (which could misparse if a highlight span itself
   * contained a literal newline). */
  lineCount: number;
}

/**
 * Terminal-chrome wrapper around an already syntax-highlighted code block:
 * a macOS traffic-light header bar with the filename, then line numbers next
 * to the highlighted source. Deliberately does not re-tokenize the code
 * itself — `rehype-highlight` (already in the Markdown pipeline for every
 * other code fence) produces better TypeScript highlighting than a hand-rolled
 * regex tokenizer reasonably could, so this component only supplies the
 * chrome, not the token classification.
 */
export function SourceViewer({ highlightedHtml, filename, lineCount }: SourceViewerProps) {
  return (
    <div className="my-6 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-3 py-2">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-500/80" />
          <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
          <span className="h-3 w-3 rounded-full bg-green-500/80" />
        </div>
        <span className="font-mono text-xs text-zinc-400">{filename}</span>
      </div>
      <div className="flex overflow-x-auto p-3 text-xs leading-5">
        <div className="mr-4 flex-none select-none text-right text-zinc-600" aria-hidden>
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <pre className="min-w-0 flex-1 text-zinc-200">
          <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
        </pre>
      </div>
    </div>
  );
}
