import { describe, expect, it } from 'vitest';
import { locationAt, type Mask } from '../locationMasks';

/** A 10x10 mask whose alpha is 255 inside the given rectangle (inclusive). */
function rectMask(x0: number, y0: number, x1: number, y1: number): Mask {
  const alpha = new Uint8ClampedArray(100);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) alpha[y * 10 + x] = 255;
  return { width: 10, height: 10, alpha };
}

describe('locationAt', () => {
  const masks = { chess: rectMask(0, 0, 4, 4), 'red-queen': rectMask(5, 5, 9, 9) };

  it('finds the location under a point given in percent', () => {
    expect(locationAt(masks, 20, 20)).toBe('chess');
    expect(locationAt(masks, 75, 75)).toBe('red-queen');
  });

  it('returns null outside every location and off the board', () => {
    expect(locationAt(masks, 75, 20)).toBeNull();
    expect(locationAt(masks, -5, 50)).toBeNull();
    expect(locationAt(masks, 50, 105)).toBeNull();
  });

  it('only counts a location when it is in the allowed list', () => {
    expect(locationAt(masks, 20, 20, ['red-queen'])).toBeNull();
  });
});
