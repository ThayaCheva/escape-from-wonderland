import { describe, expect, it } from 'vitest';
import { fanLayout } from '../layout';

describe('fanLayout', () => {
  it('fits a 25-card hand inside its edge', () => {
    const { step, total } = fanLayout(25, 500, 70);
    expect(total).toBeLessThanOrEqual(500);
    expect(step).toBeGreaterThan(0);
  });

  it('a single card has no spacing', () => {
    expect(fanLayout(1, 500, 70)).toEqual({ step: 0, total: 70 });
  });

  it('small hands use the comfortable spacing', () => {
    expect(fanLayout(5, 500, 70).step).toBe(52.5);
  });

  it('an empty hand takes no room', () => {
    expect(fanLayout(0, 500, 70)).toEqual({ step: 0, total: 0 });
  });
});

describe('edgeFor', () => {
  it('puts the viewer at the bottom and the others clockwise', async () => {
    const { edgeFor } = await import('../layout');
    expect(edgeFor(2, 0, 4)).toBe('top');
    expect(edgeFor(0, 1, 4)).toBe('right');
    expect(edgeFor(1, 0, 2)).toBe('top');
    expect(edgeFor(2, 1, 3)).toBe('left');
    expect(edgeFor(1, 1, 3)).toBe('bottom');
  });
});

describe('token slots', () => {
  it('every location slot lies inside that location (traced bounding boxes, percent)', async () => {
    const { TOKEN_SLOTS } = await import('../boardGeometry');
    // from tools/trace_locations.py output on the 1237x840 board
    const px: Record<string, [number, number, number, number]> = {
      'white-queen': [299, 336, 607, 670],
      'mad-hatter': [370, 229, 619, 474],
      'black-forest': [469, 156, 772, 312],
      chess: [622, 229, 871, 474],
      'red-queen': [634, 336, 942, 670],
    };
    for (const [loc, [l, t, r, b]] of Object.entries(px)) {
      for (const s of TOKEN_SLOTS[loc as keyof typeof TOKEN_SLOTS]) {
        expect(s.x, `${loc} x`).toBeGreaterThan((l / 1237) * 100);
        expect(s.x, `${loc} x`).toBeLessThan((r / 1237) * 100);
        expect(s.y, `${loc} y`).toBeGreaterThan((t / 840) * 100 + 2);
        expect(s.y, `${loc} y`).toBeLessThan((b / 840) * 100 - 2);
      }
    }
  });
});
