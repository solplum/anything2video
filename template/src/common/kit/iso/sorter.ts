import { Point3, Projection, depthOf } from "./math";

export interface DepthItem {
  id: string;
  points: Point3[];
  depth?: number;
  render?: () => unknown;
}

/**
 * Settles painter's order for a list of 3D parts by evaluating their true depth
 * under the given isometric camera projection.
 */
export function sortByDepth<T extends { points?: Point3[]; depth?: number }>(
  items: T[],
  projection: Projection
): T[] {
  return [...items].sort((a, b) => {
    const depthA = a.depth ?? (a.points && a.points.length ? Math.min(...a.points.map(p => depthOf(p, projection))) : 0);
    const depthB = b.depth ?? (b.points && b.points.length ? Math.min(...b.points.map(p => depthOf(p, projection))) : 0);
    return depthA - depthB; // Draw furthest back first
  });
}
