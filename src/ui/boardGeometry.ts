import type { LocationId, Position } from '../engine/types';

// All values are percentages of the board image (x of width, y of height). Tuned by eye.

export const LOCATION_AREAS: Record<LocationId, { cx: number; cy: number; rx: number; ry: number }> = {
  'white-queen': { cx: 36.5, cy: 70, rx: 11, ry: 20 },
  'mad-hatter': { cx: 40, cy: 40, rx: 8.5, ry: 13 },
  'black-forest': { cx: 50, cy: 19, rx: 11.5, ry: 8.5 },
  chess: { cx: 61.5, cy: 36, rx: 10, ry: 17 },
  'red-queen': { cx: 63.5, cy: 70, rx: 11, ry: 20 },
};

function slotsAround(cx: number, cy: number, dx = 3.2, dy = 5.5): Array<{ x: number; y: number }> {
  return [
    { x: cx - dx, y: cy - dy },
    { x: cx + dx, y: cy - dy },
    { x: cx - dx, y: cy + dy },
    { x: cx + dx, y: cy + dy },
  ];
}

export const TOKEN_SLOTS: Record<Position, Array<{ x: number; y: number }>> = {
  'white-queen': slotsAround(36.5, 66),
  'mad-hatter': slotsAround(40, 40),
  'black-forest': slotsAround(50, 18, 3.2, 4.5),
  chess: slotsAround(61.5, 36),
  'red-queen': slotsAround(63.5, 66),
  outskirts: slotsAround(50, 45, 3.2, 4.5),
};

export const DECK_BOX = { left: 81.2, top: 67.2, width: 15.1, height: 25.9 };
export const DISCARD_BOX = { left: 3.7, top: 67.2, width: 15, height: 25.9 };
export const PILE_POINT = { x: 50, y: 77 };
export const ACTIVE_ROW = { x: 50, y: 59 };
