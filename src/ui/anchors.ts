// Stage coordinates of the places animations fly between, for the layout in use.
import type { Edge, Position } from '../engine/types';
import { DECK_BOX, DISCARD_BOX, PILE_POINT, TOKEN_SLOTS } from './boardGeometry';
import { EDGE_ROTATION } from './layout';
import { boardBox, edgeBox, opponentCentre, type Point } from './geometry';
import type { ScreenKind } from './screen';

export type { Point };

export interface Anchors {
  deck: Point;
  discard: Point;
  pile: Point;
  centre: Point;
  effects: Point;
  token(pos: Position, slot?: number): Point;
  /** Where a seat's plate and hand are. Online opponents are one compact panel. */
  seat(edge: Edge, compactOpponent: boolean, opponentIndex?: number, opponentCount?: number): { plate: Point; hand: Point };
}

export function anchorsFor(kind: ScreenKind): Anchors {
  const b = boardBox(kind);
  const boardPoint = (xPct: number, yPct: number): Point => ({ x: b.left + (xPct / 100) * b.width, y: b.top + (yPct / 100) * b.height });
  const alongEdge = (edge: Edge, along: number): Point => {
    const box = edgeBox(kind, edge);
    const rad = (EDGE_ROTATION[edge] * Math.PI) / 180;
    return { x: box.cx + Math.cos(rad) * along, y: box.cy + Math.sin(rad) * along };
  };
  return {
    deck: boardPoint(DECK_BOX.left + DECK_BOX.width / 2, DECK_BOX.top + DECK_BOX.height / 2),
    discard: boardPoint(DISCARD_BOX.left + DISCARD_BOX.width / 2, DISCARD_BOX.top + DISCARD_BOX.height / 2),
    pile: boardPoint(PILE_POINT.x, PILE_POINT.y),
    centre: boardPoint(50, 45),
    effects: boardPoint(15, 12),
    token: (pos, slot = 0) => {
      const s = TOKEN_SLOTS[pos][slot % 4];
      return boardPoint(s.x, s.y);
    },
    seat: (edge, compactOpponent, opponentIndex = 0, opponentCount = 1) => {
      if (compactOpponent && edge !== 'bottom') {
        const c = opponentCentre(kind, edge, opponentIndex, opponentCount);
        return { plate: c, hand: c };
      }
      const length = edgeBox(kind, edge).length;
      return {
        plate: alongEdge(edge, -length / 2 + 123),
        hand: alongEdge(edge, -length / 2 + 252 + (length - 260) / 2),
      };
    },
  };
}
