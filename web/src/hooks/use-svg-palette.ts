"use client";

import { useDarkMode } from "./use-dark-mode";

export interface SvgPalette {
  nodeFill: string;
  nodeStroke: string;
  activeNodeFill: string;
  activeNodeStroke: string;
  endNodeFill: string;
  endNodeStroke: string;
  edgeStroke: string;
  activeEdgeStroke: string;
  labelText: string;
  activeLabelText: string;
}

const LIGHT_PALETTE: SvgPalette = {
  nodeFill: "#f8fafc",
  nodeStroke: "#cbd5e1",
  activeNodeFill: "#dbeafe",
  activeNodeStroke: "#3b82f6",
  endNodeFill: "#d1fae5",
  endNodeStroke: "#10b981",
  edgeStroke: "#cbd5e1",
  activeEdgeStroke: "#3b82f6",
  labelText: "#334155",
  activeLabelText: "#1d4ed8",
};

const DARK_PALETTE: SvgPalette = {
  nodeFill: "#131a2b",
  nodeStroke: "#334155",
  activeNodeFill: "#1e3a8a",
  activeNodeStroke: "#60a5fa",
  endNodeFill: "#064e3b",
  endNodeStroke: "#34d399",
  edgeStroke: "#334155",
  activeEdgeStroke: "#60a5fa",
  labelText: "#cbd5e1",
  activeLabelText: "#93c5fd",
};

/** Theme-aware color set for {@link StepDiagram} SVG elements, swapping via
 * {@link useDarkMode}'s `.dark`-class observer rather than CSS custom
 * properties (SVG `fill`/`stroke` attributes need real color values, not
 * `var()`, to animate smoothly through Motion). */
export function useSvgPalette(): SvgPalette {
  const isDark = useDarkMode();
  return isDark ? DARK_PALETTE : LIGHT_PALETTE;
}
