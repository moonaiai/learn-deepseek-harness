"use client";

import { motion } from "motion/react";
import { useMemo } from "react";
import { useSteppedDiagram } from "@/hooks/use-stepped-diagram";
import { useSvgPalette } from "@/hooks/use-svg-palette";
import { StepControls } from "./step-controls";
import { nodeBounds, routeEdge, type DiagramEdge, type DiagramNode } from "./edge-routing";

export interface DiagramStep {
  /** Node ids highlighted as "active" at this step. */
  activeNodeIds: string[];
  /** Edge keys (`"from->to"`) highlighted as "active" at this step. */
  activeEdgeIds: string[];
  title: string;
  desc: string;
}

export interface StepDiagramData {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  steps: DiagramStep[];
  /** SVG viewBox width/height; defaults chosen to fit typical node layouts. */
  width?: number;
  height?: number;
}

const edgeKey = (e: DiagramEdge) => `${e.from}->${e.to}`;

/**
 * A generic, data-driven stepped diagram: given a fixed node/edge layout and
 * a sequence of steps (each naming which nodes/edges are "active"), renders
 * an animated SVG plus play/pause/step controls. Edge paths are computed by
 * {@link routeEdge} rather than hand-placed per diagram, so any new chapter
 * showcase only needs to supply node positions and per-step activation
 * lists, not routing geometry.
 */
export function StepDiagram({ data }: { data: StepDiagramData }) {
  const { nodes, edges, steps, width = 420, height = 320 } = data;
  const palette = useSvgPalette();
  const diagram = useSteppedDiagram({ totalSteps: steps.length });

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const currentStepData = steps[diagram.currentStep];
  const activeNodes = new Set(currentStepData?.activeNodeIds ?? []);
  const activeEdges = new Set(currentStepData?.activeEdgeIds ?? []);

  return (
    <div className="my-6 rounded-xl border border-[--color-border] bg-[--color-surface] p-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mx-auto w-full max-w-lg"
        role="img"
        aria-label={currentStepData?.title ?? "diagram"}
      >
        <defs>
          <marker id="step-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill={palette.edgeStroke} />
          </marker>
          <marker id="step-arrow-active" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill={palette.activeEdgeStroke} />
          </marker>
        </defs>

        {edges.map((edge) => {
          const from = nodeById.get(edge.from);
          const to = nodeById.get(edge.to);
          if (!from || !to) return null;
          const isActive = activeEdges.has(edgeKey(edge));
          const d = routeEdge(from, to, nodes);
          return (
            <motion.path
              key={edgeKey(edge)}
              d={d}
              fill="none"
              stroke={isActive ? palette.activeEdgeStroke : palette.edgeStroke}
              strokeWidth={isActive ? 2.5 : 1.5}
              markerEnd={isActive ? "url(#step-arrow-active)" : "url(#step-arrow)"}
              animate={{
                stroke: isActive ? palette.activeEdgeStroke : palette.edgeStroke,
                strokeWidth: isActive ? 2.5 : 1.5,
              }}
              transition={{ duration: 0.35 }}
            />
          );
        })}

        {nodes.map((node) => {
          const isActive = activeNodes.has(node.id);
          const bounds = nodeBounds(node);
          return (
            <g key={node.id}>
              {node.shape === "diamond" ? (
                <motion.polygon
                  points={`${node.x},${bounds.top} ${bounds.right},${node.y} ${node.x},${bounds.bottom} ${bounds.left},${node.y}`}
                  fill={isActive ? palette.activeNodeFill : palette.nodeFill}
                  stroke={isActive ? palette.activeNodeStroke : palette.nodeStroke}
                  strokeWidth={1.5}
                  animate={{
                    fill: isActive ? palette.activeNodeFill : palette.nodeFill,
                    stroke: isActive ? palette.activeNodeStroke : palette.nodeStroke,
                  }}
                  transition={{ duration: 0.35 }}
                />
              ) : (
                <motion.rect
                  x={bounds.left}
                  y={bounds.top}
                  width={node.width}
                  height={node.height}
                  rx={8}
                  fill={isActive ? palette.activeNodeFill : palette.nodeFill}
                  stroke={isActive ? palette.activeNodeStroke : palette.nodeStroke}
                  strokeWidth={1.5}
                  animate={{
                    fill: isActive ? palette.activeNodeFill : palette.nodeFill,
                    stroke: isActive ? palette.activeNodeStroke : palette.nodeStroke,
                  }}
                  transition={{ duration: 0.35 }}
                />
              )}
              <text
                x={node.x}
                y={node.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={11}
                fill={isActive ? palette.activeLabelText : palette.labelText}
                fontWeight={isActive ? 600 : 400}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>

      <StepControls
        currentStep={diagram.currentStep}
        totalSteps={diagram.totalSteps}
        isPlaying={diagram.isPlaying}
        onPrev={diagram.prev}
        onNext={diagram.next}
        onToggleAutoPlay={diagram.toggleAutoPlay}
        onReset={diagram.reset}
        onGoToStep={diagram.goToStep}
        stepTitle={currentStepData?.title}
        stepDesc={currentStepData?.desc}
      />
    </div>
  );
}
