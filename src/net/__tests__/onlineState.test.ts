import { describe, expect, it } from 'vitest';
import { forgetSeatOnLeave, statusAfterError } from '../onlineState';

describe('online state rules', () => {
  it('a server error while connecting unlocks the form', () => {
    expect(statusAfterError('connecting')).toBe('idle');
    expect(statusAfterError('lobby')).toBe('lobby');
    expect(statusAfterError('game')).toBe('game');
  });

  it('leaving a game in progress keeps the seat so the link can bring you back', () => {
    expect(forgetSeatOnLeave('game', false)).toBe(false);
    expect(forgetSeatOnLeave('game', true)).toBe(true);
    expect(forgetSeatOnLeave('replaced', false)).toBe(false);
    expect(forgetSeatOnLeave('lobby', false)).toBe(true);
    expect(forgetSeatOnLeave('idle', false)).toBe(true);
  });
});
