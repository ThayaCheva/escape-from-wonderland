// Where things sit on the stage for each layout. Desktop: 1600x900. Phone (sideways): 1000x470.
import type { Edge } from '../engine/types';
import { opponentSlot, type ScreenKind } from './screen';

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}
export interface EdgeBox {
  cx: number;
  cy: number;
  length: number;
  depth: number;
}
export interface Point {
  x: number;
  y: number;
}

const DESKTOP_EDGES: Record<Edge, EdgeBox> = {
  bottom: { cx: 800, cy: 825, length: 1100, depth: 150 },
  top: { cx: 800, cy: 75, length: 1100, depth: 150 },
  left: { cx: 125, cy: 450, length: 600, depth: 250 },
  right: { cx: 1475, cy: 450, length: 600, depth: 250 },
};
const DESKTOP_OPPONENTS: Record<Exclude<Edge, 'bottom'>, Point> = {
  left: { x: 160, y: 450 },
  top: { x: 800, y: 68 },
  right: { x: 1440, y: 450 },
};

export function boardBox(kind: ScreenKind): Box {
  return kind === 'phone' ? { left: 230, top: 6, width: 530, height: 360 } : { left: 358, top: 150, width: 884, height: 600 };
}

/** The strip along one screen edge holding a plate and a hand (phone: only your own, at the bottom). */
export function edgeBox(kind: ScreenKind, edge: Edge): EdgeBox {
  if (kind === 'phone' && edge === 'bottom') return { cx: 385, cy: 420, length: 770, depth: 100 };
  return DESKTOP_EDGES[edge];
}

/** Centre of an online opponent's panel. */
export function opponentCentre(kind: ScreenKind, edge: Edge, index: number, count: number): Point {
  if (kind === 'phone') return opponentSlot(index, count);
  return DESKTOP_OPPONENTS[edge === 'bottom' ? 'top' : edge];
}

/** Phone: prompts live in the right-hand column instead of on the board. */
export const PHONE_PANEL: Point = { x: 885, y: 300 };
