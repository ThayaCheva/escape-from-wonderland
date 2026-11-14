import type { LocationId, Position } from './types';

/** Locations in clockwise order around the board's arc. */
export const LOCATIONS: readonly LocationId[] = [
  'white-queen',
  'mad-hatter',
  'black-forest',
  'chess',
  'red-queen',
];

export function nextLocationClockwise(loc: LocationId): LocationId {
  return LOCATIONS[(LOCATIONS.indexOf(loc) + 1) % LOCATIONS.length];
}

export const LOCATION_NAMES: Record<Position, string> = {
  'white-queen': "the White Queen's Castle",
  'mad-hatter': "the Mad Hatter's Place",
  'black-forest': 'the Black Forest',
  chess: 'the Chess Battlefield',
  'red-queen': "the Red Queen's Castle",
  outskirts: 'the Outskirts',
};
