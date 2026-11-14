import { describe, expect, it } from 'vitest';
import { step, IllegalActionError } from '../step';
import { makeState, num, pileOf, sp } from '../testkit';
import type { Card } from '../types';

const filler = (n: number): Card[] => Array.from({ length: n }, (_, i) => num('R', (i % 13) + 1));
const deck = (n: number) => filler(n);

describe('playing and passing', () => {
  it('a legal number play goes on the pile and the turn moves on', () => {
    const r9 = num('R', 9);
    const s0 = makeState({ players: [{ hand: [r9, num('W', 1)] }, { hand: filler(3) }, { hand: filler(3) }, { hand: filler(3) }], pile: [pileOf(num('W', 5), 3)] });
    const s = step(s0, { type: 'play', seat: 0, cardId: r9.id });
    expect(s.pile[s.pile.length - 1]).toMatchObject({ card: r9, seat: 0, effective: 9 });
    expect(s.lastNumberSeat).toBe(0);
    expect(s.current).toBe(1);
    expect(s.players[0].hand).toHaveLength(1);
  });

  it('an illegal play throws and leaves the state untouched', () => {
    const w8 = num('W', 8);
    const s0 = makeState({ players: [{ hand: [w8] }, {}, {}, {}], pile: [pileOf(num('W', 9), 3)] });
    const before = structuredClone(s0);
    expect(() => step(s0, { type: 'play', seat: 0, cardId: w8.id })).toThrow(IllegalActionError);
    expect(s0).toEqual(before);
  });

  it('acting out of turn throws', () => {
    const s0 = makeState({ players: [{ hand: filler(2) }, { hand: filler(2) }, {}, {}] });
    expect(() => step(s0, { type: 'pass', seat: 1 })).toThrow(IllegalActionError);
  });

  it('passing puts your hand down', () => {
    const s = step(makeState({ players: [{ hand: filler(2) }, { hand: filler(2) }, { hand: filler(2) }] }), { type: 'pass', seat: 0 });
    expect(s.players[0].down).toBe(true);
    expect(s.current).toBe(1);
  });

  it('a down player rejoins by playing a card', () => {
    const r1 = num('R', 1);
    const s0 = makeState({ players: [{ hand: [r1, num('R', 2)], down: true }, { hand: filler(2) }, { hand: filler(2) }] });
    const s = step(s0, { type: 'play', seat: 0, cardId: r1.id });
    expect(s.players[0].down).toBe(false);
    expect(s.log.some((l) => l.includes('rejoins'))).toBe(true);
  });

  it('a down player staying down is logged as staying down', () => {
    const s0 = makeState({ players: [{ hand: filler(2), down: true }, { hand: filler(2) }, { hand: filler(2) }] });
    const s = step(s0, { type: 'pass', seat: 0 });
    expect(s.log[s.log.length - 1]).toContain('stays down');
  });
});

describe('round end', () => {
  it('when everyone else passes, the last number player moves and a new round starts', () => {
    const r9 = num('R', 9);
    let s = makeState({
      players: [{ hand: [r9, ...filler(2)] }, { hand: filler(3) }, { hand: filler(3) }, { hand: filler(3) }],
      deck: deck(10),
    });
    s = step(s, { type: 'play', seat: 0, cardId: r9.id });
    s = step(s, { type: 'pass', seat: 1 });
    s = step(s, { type: 'pass', seat: 2 });
    s = step(s, { type: 'pass', seat: 3 });
    expect(s.prompts).toEqual([{ type: 'round-end-move', seat: 0 }]);
    s = step(s, { type: 'choose-location', seat: 0, location: 'mad-hatter' });
    expect(s.players[0].position).toBe('mad-hatter');
    expect(s.pile).toEqual([]);
    expect(s.players.map((p) => p.hand.length)).toEqual([3, 4, 4, 4]);
    expect(s.round).toBe(2);
    expect(s.current).toBe(0);
    expect(s.players.every((p) => !p.down)).toBe(true);
  });

  it('choosing to stay keeps the token where it is', () => {
    const r9 = num('R', 9);
    let s = makeState({ players: [{ hand: [r9, ...filler(2)], position: 'chess' }, { hand: filler(3) }, { hand: filler(3) }], deck: deck(10) });
    s = step(s, { type: 'play', seat: 0, cardId: r9.id });
    s = step(s, { type: 'pass', seat: 1 });
    s = step(s, { type: 'pass', seat: 2 });
    s = step(s, { type: 'choose-location', seat: 0, location: null });
    expect(s.players[0].position).toBe('chess');
    expect(s.round).toBe(2);
  });

  it('with no number card played this round nobody moves', () => {
    let s = makeState({ players: [{ hand: filler(3) }, { hand: filler(3) }, { hand: filler(3) }], deck: deck(10) });
    s = step(s, { type: 'pass', seat: 0 });
    s = step(s, { type: 'pass', seat: 1 });
    expect(s.prompts).toEqual([]);
    expect(s.round).toBe(2);
    expect(s.current).toBe(2);
  });

  it('round end where the standing player is not the last number player', () => {
    let t = makeState({ players: [{ hand: [num('R', 9), ...filler(2)] }, { hand: filler(3) }, { hand: filler(3) }], deck: deck(10) });
    t = step(t, { type: 'play', seat: 0, cardId: t.players[0].hand[0].id });
    t = step(t, { type: 'pass', seat: 1 });
    t.players[2].hand.push(sp('rq-decree'));
    t.players[2].position = 'red-queen';
    t = step(t, { type: 'play', seat: 2, cardId: t.players[2].hand[t.players[2].hand.length - 1].id });
    t = step(t, { type: 'pass', seat: 0 });
    expect(t.prompts[0]).toEqual({ type: 'round-end-move', seat: 0 });
    t = step(t, { type: 'choose-location', seat: 0, location: null });
    expect(t.current).toBe(2);
  });
});

describe('turn effects', () => {
  it('a skipped player loses one turn and the flag clears', () => {
    let s = makeState({ players: [{ hand: filler(3) }, { hand: filler(3), skipNextTurn: true }, { hand: filler(3) }] });
    s = step(s, { type: 'play', seat: 0, cardId: s.players[0].hand[0].id });
    expect(s.current).toBe(2);
    expect(s.players[1].skipNextTurn).toBe(false);
  });

  it('the Drink Me lock is active for exactly the next turn', () => {
    let s = makeState({ players: [{ hand: filler(5), drinkMeLock: 'pending' }, { hand: filler(5) }, { hand: filler(5) }], current: 2 });
    s = step(s, { type: 'pass', seat: 2 });
    expect(s.players[0].drinkMeLock).toBe('active');
    s = step(s, { type: 'play', seat: 0, cardId: s.players[0].hand[0].id });
    expect(s.players[0].drinkMeLock).toBe('none');
  });
});

describe('winning', () => {
  it('playing your last card wins', () => {
    const r9 = num('R', 9);
    const s = step(makeState({ players: [{ hand: [r9] }, { hand: filler(2) }, { hand: filler(2) }] }), { type: 'play', seat: 0, cardId: r9.id });
    expect(s.phase).toBe('game-over');
    expect(s.winner).toBe(0);
    expect(s.log[s.log.length - 1]).toContain('escapes Wonderland');
  });

  it('simultaneous empty hands go to the first clockwise from the causer', () => {
    // seat 2 plays its last-but-one card while seats 1 and 3 are already empty (hand-built)
    const r9 = num('R', 9);
    const s0 = makeState({ players: [{ hand: filler(2) }, { hand: [] }, { hand: [r9, num('R', 10)] }, { hand: [] }], current: 2 });
    const s = step(s0, { type: 'play', seat: 2, cardId: r9.id });
    expect(s.winner).toBe(3);
  });
});

describe('specials', () => {
  it('lasting specials go to the active area and others to the discard pile', () => {
    let s = makeState({ players: [{ hand: [sp('cheshire-cat'), ...filler(2)] }, { hand: filler(2) }, { hand: filler(2) }] });
    s = step(s, { type: 'play', seat: 0, cardId: s.players[0].hand[0].id });
    expect(s.active.map((a) => a.card.name)).toEqual(['cheshire-cat']);
    let t = makeState({ players: [{ hand: [sp('rq-decree'), ...filler(2)], position: 'red-queen' }, { hand: filler(2) }, { hand: filler(2) }], deck: deck(5) });
    t = step(t, { type: 'play', seat: 0, cardId: t.players[0].hand[0].id });
    expect(t.discard.map((c) => c.kind === 'number' ? '' : c.name)).toEqual(['rq-decree']);
  });
});

describe('2-player variant', () => {
  it('a single pass ends the round', () => {
    const r9 = num('R', 9);
    let s = makeState({ players: [{ hand: [r9, ...filler(2)] }, { hand: filler(3) }], deck: deck(10) });
    s = step(s, { type: 'play', seat: 0, cardId: r9.id });
    s = step(s, { type: 'pass', seat: 1 });
    expect(s.prompts).toEqual([{ type: 'round-end-move', seat: 0 }]);
  });
});

describe('location validation', () => {
  it('round-end move rejects locations that do not exist and the Outskirts', () => {
    const r9 = num('R', 9);
    let s = makeState({ players: [{ hand: [r9, ...filler(2)] }, { hand: filler(3) }], deck: deck(10) });
    s = step(s, { type: 'play', seat: 0, cardId: r9.id });
    s = step(s, { type: 'pass', seat: 1 });
    expect(() => step(s, { type: 'choose-location', seat: 0, location: 'x' as never })).toThrow(IllegalActionError);
    expect(() => step(s, { type: 'choose-location', seat: 0, location: 'outskirts' as never })).toThrow(IllegalActionError);
  });
});
