import { describe, expect, it } from 'vitest';
import { confirm, faceUpHandSeat, needsHandoff, revealedOtherHand, type UiGate } from '../visibility';
import { newGame } from '../../engine/setup';
import { makeState, num } from '../../engine/testkit';

const fill = () => [num('R', 1), num('R', 2)];

describe('visibility', () => {
  it('a fresh game needs a hand-off, then shows the picker their own hand', () => {
    const s = newGame({ playerCount: 4, seed: 1 });
    const gate: UiGate = { confirmedSeat: null, peeked: false };
    expect(needsHandoff(s, gate)).toBe(true);
    expect(faceUpHandSeat(s, gate)).toBeNull();
    const confirmed = confirm(s);
    expect(needsHandoff(s, confirmed)).toBe(false);
    expect(faceUpHandSeat(s, confirmed)).toBe(0);
  });

  it('on a normal turn the hand stays face down until peeked', () => {
    const s = makeState({ players: [{ hand: fill() }, { hand: fill() }, { hand: fill() }] });
    expect(faceUpHandSeat(s, { confirmedSeat: 0, peeked: false })).toBeNull();
    expect(faceUpHandSeat(s, { confirmedSeat: 0, peeked: true })).toBe(0);
  });

  it("another player's private prompt hides the current hand and needs a hand-off, and so does coming back", () => {
    const s = makeState({ players: [{ hand: fill() }, { hand: fill() }, { hand: fill() }] });
    s.prompts = [{ type: 'discard', seat: 2, min: 1, max: 1, drawAfter: 0, reason: 'x' }];
    expect(needsHandoff(s, { confirmedSeat: 0, peeked: true })).toBe(true);
    expect(faceUpHandSeat(s, { confirmedSeat: 0, peeked: true })).toBeNull();
    const back = makeState({ players: [{ hand: fill() }, { hand: fill() }, { hand: fill() }] });
    expect(needsHandoff(back, { confirmedSeat: 2, peeked: false })).toBe(true);
    expect(faceUpHandSeat(back, { confirmedSeat: 2, peeked: false })).toBeNull();
  });

  it('confirming resets peeking', () => {
    const s = makeState({ players: [{ hand: fill() }, { hand: fill() }, { hand: fill() }] });
    expect(confirm(s)).toEqual({ confirmedSeat: 0, peeked: false });
  });

  it('Caterpillar shows the target hand to the viewer but not the viewer hand', () => {
    const s = makeState({ players: [{ hand: fill() }, { hand: fill() }, { hand: fill() }, { hand: fill() }] });
    s.prompts = [{ type: 'view-hand', seat: 1, target: 3 }];
    const gate = { confirmedSeat: 1, peeked: false };
    expect(revealedOtherHand(s, gate)).toBe(3);
    expect(faceUpHandSeat(s, gate)).toBeNull();
    expect(revealedOtherHand(s, { confirmedSeat: 0, peeked: false })).toBeNull();
  });

  it('no hand-off once the game is over', () => {
    const s = makeState({ players: [{ hand: [] }, { hand: fill() }, { hand: fill() }] });
    s.phase = 'game-over';
    expect(needsHandoff(s, { confirmedSeat: null, peeked: false })).toBe(false);
  });
});
