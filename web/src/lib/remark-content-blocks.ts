import { visit } from "unist-util-visit";
import type { Blockquote, Root } from "mdast";
import type { ContainerDirective } from "mdast-util-directive";

/**
 * Structured-content remark plugin: turns two Markdown conventions into the
 * styled interactive blocks that replace the chapters' old "wall of text." It
 * is the content-block counterpart to `remark-source-viewer-meta.ts` and runs
 * right after it in the pipeline (`lib/markdown.ts`), before `remark-rehype`,
 * so the `hProperties` it attaches survive into the final HTML and the
 * client-side `ContentBlockHydrator` can mount interactive components on top.
 *
 * Two Markdown conventions, one plugin:
 *
 * 1. Callout blockquotes — `> [!WHY]` / `> [!LIMITATION]` / `> [!NOTE]` /
 *    `> [!PITFALL]` at the head of a blockquote. The marker is stripped and the
 *    blockquote gets `callout callout-<kind>` classes; styling is pure CSS,
 *    no hydration. Highest-frequency, zero-interactive block.
 *
 * 2. Container directives — `:::concept` / `:::decision` / `:::timeline` /
 *    `:::fold` (parsed by `remark-directive`, which is registered immediately
 *    before this plugin). Each maps to an element carrying
 *    `data-block="<kind>"` so `ContentBlockHydrator` can swap it for the
 *    matching React block. Directive attributes (e.g. `:::concept{term="…"}`)
 *    become `data-*` props. `:::fold` maps to a styled `<details>` whose
 *    `:::fold [summary text]` bracket label becomes the `<summary>`.
 */

const CALLOUT_MARKER_RE = /^\s*\[!(WHY|LIMITATION|NOTE|PITFALL)\]\s*/i;

type BlockKind = "concept" | "decision" | "timeline" | "fold";

const BLOCK_TAGS: Record<BlockKind, string> = {
  concept: "div",
  decision: "div",
  timeline: "div",
  fold: "details",
};

/** First callout line marker, or null — matched against the blockquote's text. */
function calloutKind(node: Blockquote): string | null {
  const firstLine = node.children
    .flatMap((c) => (c.type === "paragraph" ? c.children : []))
    .find((c) => c.type === "text") as { value?: string } | undefined;
  const match = firstLine?.value != null ? CALLOUT_MARKER_RE.exec(firstLine.value) : null;
  if (!match) return null;
  // Strip the marker from the text node in place.
  if (firstLine && typeof firstLine.value === "string") {
    firstLine.value = firstLine.value.replace(CALLOUT_MARKER_RE, "");
  }
  return match![1].toLowerCase();
}

/**Serialize directive leaf/block label (`:::fold [text]`) into a summary string. */
function directiveSummary(node: ContainerDirective): string | null {
  for (const child of node.children) {
    const data = child.data as { directiveLabel?: boolean } | undefined;
    if (data?.directiveLabel && child.type === "paragraph") {
      const text = (child as { children?: Array<{ value?: string }> }).children
        ?.map((c) => c.value ?? "")
        .join("")
        .trim();
      return text || null;
    }
  }
  return null;
}

export function remarkContentBlocks() {
  return (tree: Root) => {
    // 1. Callout blockquotes → `callout callout-<kind>` classes (CSS-only).
    visit(tree, "blockquote", (node: Blockquote) => {
      const kind = calloutKind(node);
      if (!kind) return;
      node.data = {
        ...node.data,
        hProperties: {
          ...(node.data?.hProperties as Record<string, unknown> | undefined),
          className: [`callout`, `callout-${kind}`],
          "data-kind": kind,
        },
      };
    });

    // 2. Container directives → `data-block="<kind>"` elements for hydration.
    visit(tree, "containerDirective", (node: ContainerDirective) => {
      const name = (node.name ?? "") as BlockKind;
      const tag = BLOCK_TAGS[name];
      if (!tag) return;

      const summary = directiveSummary(node);
      const props: Record<string, string> = {
        "data-block": name,
      };
      // Carry directive attributes through as data-* for the hydrator.
      for (const [key, value] of Object.entries(node.attributes ?? {})) {
        if (typeof value === "string") props[`data-${key}`] = value;
      }
      if (name === "fold" && summary) props["data-summary"] = summary;
      // Strip the directive-label paragraph so it doesn't render twice.
      node.children = node.children.filter(
        (c) => !(c.data as { directiveLabel?: boolean } | undefined)?.directiveLabel,
      );

      node.data = {
        ...node.data,
        hName: tag,
        hProperties: {
          ...(node.data?.hProperties as Record<string, string> | undefined),
          ...props,
        },
      };
    });
  };
}
