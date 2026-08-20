import type { ReactNode } from "react";

/**
 * One inline section of the chapter document (Visualize / Play / Deep-Dive —
 * Reading is the untitled lead). Unlike the old tab widget that crammed each
 * mode into a mount-on-click tab, these are sequential `<section>` blocks in
 * the flowing document, each with a small over-title label so the reader can
 * skim the chapter's structure and scroll straight to the part they want.
 */
export function DocSection({
  overtitle,
  children,
}: {
  overtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-14">
      {overtitle ? (
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-[--color-text-faint]">
          {overtitle}
        </h2>
      ) : null}
      {children}
    </section>
  );
}
