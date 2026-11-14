import { describe, expect, it } from 'vitest';
import { newGame } from '../setup';
import { step, IllegalActionError } from '../step';
import { drawCards, moveToken } from '../mutate';
import { isNumber } from '../cards';
import { makeState, num, sp } from '../testkit';
import type { GameState, NumberCard } from '../types';

/** Give each seat a specific number card to pick (swapped into their hand). */
function rig(state: GameState, picks: Array<NumberCard | null>): GameState {
  picks.forEach((card, seat) => {
    const hand = state.players[seat].hand;
    if (card) hand[0] = card;
    else state.players[seat].hand = hand.map((_, i) => sp(i % 2 ? 'exile' : 'vines'));
  });
  return state;
}
function pickAll(state: GameState, picks: Array<NumberCard | null>): GameState {
  let s = state;
  picks.forEach((card, seat) => {
    s = step(s, { type: 'setup-pick', seat, cardId: card ? card.id : null });
  });
  return s;
}

describe('newGame', () => {
  it('deals 7 to each of 4 players and asks each for a pick', () => {
    const s = newGame({ playerCount: 4, seed: 7 });
    expect(s.phase).toBe('setup');
    expect(s.players.map((p) => p.hand.length)).toEqual([7, 7, 7, 7]);
    expect(s.deck).toHaveLength(114);
    expect(s.prompts).toEqual([0, 1, 2, 3].map((seat) => ({ type: 'setup-pick', seat })));
    expect(s.players.map((p) => p.edge)).toEqual(['bottom', 'left', 'top', 'right']);
    expect(s.players.map((p) => p.alice)).toEqual(['gold', 'rose', 'blue', 'mint']);
    expect(s.players.every((p) => p.position === 'outskirts')).toBe(true);
  });

  it('seats 3 players bottom, left, right', () => {
    const s = newGame({ playerCount: 3, seed: 7 });
    expect(s.players.map((p) => p.edge)).toEqual(['bottom', 'left', 'right']);
    expect(s.players.map((p) => p.alice)).toEqual(['gold', 'rose', 'mint']);
    expect(s.deck).toHaveLength(121);
  });

  it('uses given names', () => {
    const s = newGame({ playerCount: 3, seed: 7, names: ['Ann', '', 'Cy'] });
    expect(s.players.map((p) => p.name)).toEqual(['Ann', 'Rose Alice', 'Cy']);
  });
});

describe('setup picks', () => {
  it('lowest goes first and cards stack lowest to highest', () => {
    const picks = [num('W', 5), num('R', 5), num('R', 2), num('W', 13)];
    const s = pickAll(rig(newGame({ playerCount: 4, seed: 7 }), picks), picks);
    expect(s.phase).toBe('playing');
    expect(s.current).toBe(2);
    expect(s.pile.map((e) => e.card.value)).toEqual([2, 5, 5, 13]);
    expect(s.pile.map((e) => e.card.color)).toEqual(['red', 'red', 'white', 'white']);
    expect(s.lastNumberSeat).toBe(3);
    expect(s.round).toBe(1);
    expect(s.players[2].hand).toHaveLength(6);
  });

  it('rejects picking a non-number card', () => {
    const s = newGame({ playerCount: 4, seed: 7 });
    s.players[0].hand[0] = sp('exile');
    expect(() => step(s, { type: 'setup-pick', seat: 0, cardId: s.players[0].hand[0].id })).toThrow(IllegalActionError);
  });

  it('rejects picking nothing while holding a number card', () => {
    const s = rig(newGame({ playerCount: 4, seed: 7 }), [num('R', 3), null, null, null]);
    expect(() => step(s, { type: 'setup-pick', seat: 0, cardId: null })).toThrow(IllegalActionError);
  });

  it('a player with no number card picks nothing and is excluded', () => {
    const picks = [num('W', 5), null, num('R', 9), num('W', 13)];
    const s = pickAll(rig(newGame({ playerCount: 4, seed: 7 }), picks), picks);
    expect(s.pile).toHaveLength(3);
    expect(s.current).toBe(0);
  });

  it('identical picks are broken at random, deterministically per seed', () => {
    const run = () => {
      const picks = [num('R', 4), num('R', 4), num('W', 9), num('W', 10)];
      return pickAll(rig(newGame({ playerCount: 4, seed: 11 }), picks), picks);
    };
    const a = run();
    const b = run();
    expect(a.current).toBe(b.current);
    expect([0, 1]).toContain(a.current);
    expect(a.log.some((l) => l.includes('broken at random'))).toBe(true);
  });

  it('acting out of order is rejected', () => {
    const s = newGame({ playerCount: 4, seed: 7 });
    const card = s.players[1].hand.find(isNumber)!;
    expect(() => step(s, { type: 'setup-pick', seat: 1, cardId: card.id })).toThrow(IllegalActionError);
  });
});

describe('mutators', () => {
  it('drawCards reshuffles the discard pile when the deck is empty', () => {
    const s = makeState({ players: [{}, {}, {}], discard: [num('R', 1), num('R', 2), num('R', 3)] });
    expect(drawCards(s, 0, 2)).toBe(2);
    expect(s.players[0].hand).toHaveLength(2);
    expect(s.deck).toHaveLength(1);
    expect(s.discard).toHaveLength(0);
  });

  it('drawCards with deck and discard both empty draws nothing', () => {
    const s = makeState({ players: [{}, {}, {}] });
    expect(drawCards(s, 0, 3)).toBe(0);
    expect(s.players[0].hand).toHaveLength(0);
  });

  it("moveToken out of the Black Forest discards that player's Shadow Creatures only", () => {
    const mine = { card: sp('shadow-creatures'), seat: 0 };
    const theirs = { card: sp('shadow-creatures'), seat: 1 };
    const s = makeState({ players: [{ position: 'black-forest' }, { position: 'black-forest' }, {}], active: [mine, theirs] });
    moveToken(s, 0, 'chess');
    expect(s.players[0].position).toBe('chess');
    expect(s.active).toEqual([theirs]);
    expect(s.discard).toEqual([mine.card]);
  });
});
