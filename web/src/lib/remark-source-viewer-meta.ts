import { visit } from "unist-util-visit";
import type { Root, Code } from "mdast";

const FILENAME_META_RE = /filename="([^"]+)"/;

/**
 * Remark plugin: reads `filename="path/to/file.ts"` out of a fenced code
 * block's info string (e.g. ` ```ts filename="packages/core/tools/src/index.ts" `)
 * and attaches it as `data-filename` on the resulting `<code>` element via
 * `hProperties` — the standard mdast-to-hast escape hatch (see
 * `mdast-util-to-hast`'s `state.js`, which merges `node.data.hProperties`
 * into the hast element's properties). `SourceViewerHydrator` looks for this
 * attribute client-side to swap the block for a `SourceViewer`.
 */
export function remarkSourceViewerMeta() {
  return (tree: Root) => {
    visit(tree, "code", (node: Code) => {
      if (!node.meta) return;
      const match = FILENAME_META_RE.exec(node.meta);
      if (!match) return;
      node.data = {
        ...node.data,
        hProperties: {
          ...(node.data?.hProperties as Record<string, unknown> | undefined),
          dataFilename: match[1],
        },
      };
    });
  };
}
