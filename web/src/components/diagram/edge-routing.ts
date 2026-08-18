/**
 * Procedural edge-path routing for {@link StepDiagram}: given two node
 * bounding boxes, picks a routing strategy from their relative geometry
 * (straight line, loop-back rail, or Bezier curve) rather than requiring
 * every diagram author to hand-place edge coordinates.
 */

export interface NodeBounds {
  cx: number;
  cy: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface DiagramNode {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape?: "rect" | "diamond";
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
}

const LOOP_BACK_DY_LIMIT = 30;
const LOOP_BACK_DX_LIMIT = 40;
const LOOP_RAIL_MARGIN = 36;

export function nodeBounds(node: DiagramNode): NodeBounds {
  return {
    cx: node.x,
    cy: node.y,
    left: node.x - node.width / 2,
    right: node.x + node.width / 2,
    top: node.y - node.height / 2,
    bottom: node.y + node.height / 2,
  };
}

function isLoopBack(from: NodeBounds, to: NodeBounds): boolean {
  const dy = to.cy - from.cy;
  const dx = to.cx - from.cx;
  return dy < -LOOP_BACK_DY_LIMIT && Math.abs(dx) <= LOOP_BACK_DX_LIMIT;
}

/** Computes an SVG path `d` attribute routing from one node's edge to
 * another's, choosing among a loop-back rail, a straight line, or a cubic
 * Bezier depending on their relative position — so diagram authors supply
 * only node positions, never edge coordinates. */
export function routeEdge(fromNode: DiagramNode, toNode: DiagramNode, allNodes: DiagramNode[]): string {
  const from = nodeBounds(fromNode);
  const to = nodeBounds(toNode);
  const dx = to.cx - from.cx;
  const dy = to.cy - from.cy;

  if (isLoopBack(from, to)) {
    const goRight = dx >= 0;
    const clearanceX = allNodes.reduce(
      (extreme, n) => {
        const b = nodeBounds(n);
        return goRight ? Math.max(extreme, b.right) : Math.min(extreme, b.left);
      },
      goRight ? from.right : from.left,
    );
    const railX = clearanceX + (goRight ? LOOP_RAIL_MARGIN : -LOOP_RAIL_MARGIN);
    const startX = goRight ? from.right : from.left;
    const endX = goRight ? to.right : to.left;
    const midY = (from.cy + to.cy) / 2;
    return `M ${startX} ${from.cy} C ${railX} ${from.cy}, ${railX} ${midY}, ${railX} ${midY} C ${railX} ${to.cy}, ${endX} ${to.cy}, ${endX} ${to.cy}`;
  }

  if (Math.abs(dx) < 12) {
    return dy >= 0 ? `M ${from.cx} ${from.bottom} L ${to.cx} ${to.top}` : `M ${from.cx} ${from.top} L ${to.cx} ${to.bottom}`;
  }

  if (Math.abs(dy) < 12) {
    const startX = dx > 0 ? from.right : from.left;
    const endX = dx > 0 ? to.left : to.right;
    const midX = (startX + endX) / 2;
    return `M ${startX} ${from.cy} C ${midX} ${from.cy}, ${midX} ${to.cy}, ${endX} ${to.cy}`;
  }

  const startY = dy > 0 ? from.bottom : from.top;
  const endY = dy > 0 ? to.top : to.bottom;
  const control = Math.max(40, Math.abs(endY - startY) * 0.4);
  const c1 = startY + (endY > startY ? control : -control);
  const c2 = endY - (endY > startY ? control : -control);
  return `M ${from.cx} ${startY} C ${from.cx} ${c1}, ${to.cx} ${c2}, ${to.cx} ${endY}`;
}
