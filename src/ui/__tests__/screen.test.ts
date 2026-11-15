import { describe, expect, it } from 'vitest';
import { opponentSlot, pickScreen } from '../screen';

describe('pickScreen', () => {
  it('uses the phone layout for small touch screens held sideways or upright', () => {
    expect(pickScreen(844, 390, true)).toEqual({ kind: 'phone', portrait: false });
    expect(pickScreen(390, 844, true)).toEqual({ kind: 'phone', portrait: true });
    expect(pickScreen(915, 412, true)).toEqual({ kind: 'phone', portrait: false });
  });

  it('keeps the desktop layout for PCs and tablets', () => {
    expect(pickScreen(1366, 768, false)).toEqual({ kind: 'desktop', portrait: false });
    expect(pickScreen(1180, 820, true)).toEqual({ kind: 'desktop', portrait: false });
    // a small desktop window is still a desktop
    expect(pickScreen(800, 450, false)).toEqual({ kind: 'desktop', portrait: false });
  });
});

describe('opponentSlot (phone)', () => {
  it('stacks opponents down the left side, evenly spaced', () => {
    expect(opponentSlot(0, 1)).toEqual({ x: 112, y: 183 });
    expect(opponentSlot(0, 3)).toEqual({ x: 112, y: 61 });
    expect(opponentSlot(2, 3)).toEqual({ x: 112, y: 305 });
  });
});
