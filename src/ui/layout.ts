import type { Edge } from '../engine/types';

/** Rotation (degrees) that turns an edge's content to face the player sitting there. */
export const EDGE_ROTATION: Record<Edge, number> = { bottom: 0, left: 90, top: 180, right: -90 };

/** Spacing for a fanned hand of `count` cards inside `available` pixels. */
export function fanLayout(count: number, available: number, cardWidth: number): { step: number; total: number } {
  if (count <= 0) return { step: 0, total: 0 };
  if (count === 1) return { step: 0, total: cardWidth };
  const step = Math.min(cardWidth * 0.75, (available - cardWidth) / (count - 1));
  return { step, total: cardWidth + step * (count - 1) };
}
