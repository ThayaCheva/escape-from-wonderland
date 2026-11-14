// Stage coordinates (1600x900) of the places animations fly between.
import type { Edge, Position } from '../engine/types';
import { DECK_BOX, DISCARD_BOX, PILE_POINT, TOKEN_SLOTS } from './boardGeometry';
import { EDGE_ROTATION } from './layout';

export interface Point {
  x: number;
  y: number;
}

const BOARD = { left: 358, top: 150, width: 884, height: 600 };
const EDGE_BOXES: Record<Edge, { cx: number; cy: number; length: number }> = {
  bottom: { cx: 800, cy: 825, length: 1100 },
  top: { cx: 800, cy: 75, length: 1100 },
  left: { cx: 125, cy: 450, length: 600 },
  right: { cx: 1475, cy: 450, length: 600 },
};
const OPPONENT_CENTRE: Record<Exclude<Edge, 'bottom'>, Point> = {
  left: { x: 160, y: 450 },
  top: { x: 800, y: 68 },
  right: { x: 1440, y: 450 },
};

export const boardPoint = (xPct: number, yPct: number): Point => ({
  x: BOARD.left + (xPct / 100) * BOARD.width,
  y: BOARD.top + (yPct / 100) * BOARD.height,
});

export const DECK_POINT = boardPoint(DECK_BOX.left + DECK_BOX.width / 2, DECK_BOX.top + DECK_BOX.height / 2);
export const DISCARD_POINT = boardPoint(DISCARD_BOX.left + DISCARD_BOX.width / 2, DISCARD_BOX.top + DISCARD_BOX.height / 2);
export const PILE_POINT_STAGE = boardPoint(PILE_POINT.x, PILE_POINT.y);
export const BOARD_CENTRE = boardPoint(50, 45);
export const EFFECTS_POINT = boardPoint(15, 12);

/** A point `along` pixels from the centre of an edge strip, following the strip's rotation. */
function alongEdge(edge: Edge, along: number): Point {
  const box = EDGE_BOXES[edge];
  const rad = (EDGE_ROTATION[edge] * Math.PI) / 180;
  return { x: box.cx + Math.cos(rad) * along, y: box.cy + Math.sin(rad) * along };
}

/** Where a seat's name plate and hand are on screen. Online opponents are one compact panel. */
export function seatAnchors(edge: Edge, compactOpponent: boolean): { plate: Point; hand: Point } {
  if (compactOpponent && edge !== 'bottom') {
    const c = OPPONENT_CENTRE[edge];
    return { plate: c, hand: c };
  }
  const length = EDGE_BOXES[edge].length;
  return {
    plate: alongEdge(edge, -length / 2 + 123),
    hand: alongEdge(edge, -length / 2 + 252 + (length - 260) / 2),
  };
}

/** A token's spot on the board (the first slot of its position). */
export function tokenPoint(pos: Position, slot = 0): Point {
  const s = TOKEN_SLOTS[pos][slot % 4];
  return boardPoint(s.x, s.y);
}
