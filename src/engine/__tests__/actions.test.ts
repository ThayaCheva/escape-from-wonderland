import { describe, expect, it } from 'vitest';
import { step, IllegalActionError } from '../step';
import { endRound } from '../flow';
import { checkPlay } from '../rules';
import { makeState, num, pileOf, sp } from '../testkit';
import type { Card, GameState } from '../types';

const filler = (n: number, color: 'R' | 'W' = 'R'): Card[] => Array.from({ length: n }, (_, i) => num(color, 13 - (i % 3)));
const deck = (n: number) => filler(n, 'W');

function play(s: GameState, seat: number, card: Card) {
  return step(s, { type: 'play', seat, cardId: card.id });
}

describe('Drink Me Potion', () => {
  it('allows two free extra plays and locks the next turn to numbers', () => {
    const drink = sp('drink-me');
    const w2 = num('W', 2);
    const r3 = num('R', 3);
    const exile = sp('exile');
    let s = makeState({
      players: [{ hand: [drink, w2, r3, exile, ...filler(2)] }, { hand: filler(3) }, { hand: filler(3) }],
      pile: [pileOf(num('W', 13), 1)],
    });
    s = play(s, 0, drink);
    expect(s.prompts).toEqual([{ type: 'drink-me-extra', seat: 0, remaining: 2 }]);
    s = play(s, 0, w2);
    expect(s.pile[s.pile.length - 1].card).toEqual(w2);
    expect(s.prompts).toEqual([{ type: 'drink-me-extra', seat: 0, remaining: 1 }]);
    s = play(s, 0, r3);
    expect(s.prompts).toEqual([]);
    expect(s.current).toBe(1);
    expect(s.players[0].drinkMeLock).toBe('pending');
    s = step(s, { type: 'pass', seat: 1 });
    s = step(s, { type: 'pass', seat: 2 });
    // round ends (seat 0 standing) — move prompt, then seat 0 starts round 2 under the lock
    s = step(s, { type: 'choose-location', seat: 0, location: null });
    expect(s.current).toBe(0);
    expect(s.players[0].drinkMeLock).toBe('active');
    expect(checkPlay(s, 0, exile.id)).toEqual({ ok: false, reason: 'Drink Me: only number cards this turn.' });
  });

  it('done ends the turn immediately', () => {
    const drink = sp('drink-me');
    let s = makeState({ players: [{ hand: [drink, ...filler(2)] }, { hand: filler(3) }, { hand: filler(3) }] });
    s = play(s, 0, drink);
    s = step(s, { type: 'done', seat: 0 });
    expect(s.current).toBe(1);
  });

  it('as your last card it wins with no extra prompt', () => {
    const drink = sp('drink-me');
    const s = play(makeState({ players: [{ hand: [drink] }, { hand: filler(3) }, { hand: filler(3) }] }), 0, drink);
    expect(s.winner).toBe(0);
  });

  it("an extra card's prompts come before the remaining extra", () => {
    const drink = sp('drink-me');
    const exile = sp('exile');
    let s = makeState({ players: [{ hand: [drink, exile, ...filler(2)] }, { hand: filler(3) }, { hand: filler(3) }], deck: deck(5) });
    s = play(s, 0, drink);
    s = play(s, 0, exile);
    expect(s.prompts.map((p) => p.type)).toEqual(['choose-player', 'drink-me-extra']);
    expect(s.prompts[1]).toMatchObject({ remaining: 1 });
  });
});

describe('Eat Me Cake', () => {
  it('discards number cards adding up to 5 or less', () => {
    const eat = sp('eat-me');
    const r2 = num('R', 2);
    const w3 = num('W', 3);
    const w4 = num('W', 4);
    let s = makeState({ players: [{ hand: [eat, r2, w3, w4, ...filler(1)] }, { hand: filler(3) }, { hand: filler(3) }] });
    s = play(s, 0, eat);
    expect(s.prompts).toEqual([{ type: 'eat-me', seat: 0 }]);
    expect(() => step(s, { type: 'choose-cards', seat: 0, cardIds: [r2.id, w4.id] })).toThrow(IllegalActionError);
    s = step(s, { type: 'choose-cards', seat: 0, cardIds: [r2.id, w3.id] });
    expect(s.players[0].hand).toHaveLength(2);
    expect(s.current).toBe(1);
  });

  it('an empty choice is allowed', () => {
    const eat = sp('eat-me');
    let s = makeState({ players: [{ hand: [eat, num('R', 2), ...filler(1)] }, { hand: filler(3) }, { hand: filler(3) }] });
    s = play(s, 0, eat);
    s = step(s, { type: 'choose-cards', seat: 0, cardIds: [] });
    expect(s.players[0].hand).toHaveLength(2);
  });

  it('no prompt when no number card is 5 or less', () => {
    const eat = sp('eat-me');
    const s = play(makeState({ players: [{ hand: [eat, ...filler(2)] }, { hand: filler(3) }, { hand: filler(3) }] }), 0, eat);
    expect(s.prompts).toEqual([]);
    expect(s.current).toBe(1);
  });
});

describe('Vorpal Sword', () => {
  it('slays an active card', () => {
    const sword = sp('vorpal-sword');
    const jab = { card: sp('jabberwocky'), seat: 1 };
    const cat = { card: sp('cheshire-cat'), seat: 2 };
    let s = makeState({ players: [{ hand: [sword, ...filler(2)] }, { hand: filler(3) }, { hand: filler(3) }], active: [cat, jab] });
    s = play(s, 0, sword);
    expect(s.prompts).toEqual([{ type: 'vorpal-target', seat: 0 }]);
    expect(() => step(s, { type: 'choose-active', seat: 0, index: 0 })).toThrow(IllegalActionError);
    s = step(s, { type: 'choose-active', seat: 0, index: 1 });
    expect(s.active).toEqual([cat]);
    expect(s.discard).toEqual(expect.arrayContaining([sword, jab.card]));
    expect(s.log.some((l) => l.includes('slays'))).toBe(true);
  });
});

describe('Cheshire Cat', () => {
  it('a second copy cannot be played in the same round, but can next round', () => {
    const cat1 = sp('cheshire-cat');
    const cat2 = sp('cheshire-cat');
    let s = makeState({ players: [{ hand: [cat1, ...filler(2)] }, { hand: [cat2, ...filler(2)] }, { hand: filler(3) }], deck: deck(6) });
    s = play(s, 0, cat1);
    expect(s.cheshireUsedThisRound).toBe(true);
    expect(() => play(s, 1, cat2)).toThrow('Only one Cheshire Cat per round.');
    s.roundEnding = { starter: 1 };
    endRound(s);
    expect(checkPlay(s, 1, cat2.id)).toEqual({ ok: true });
  });
});

describe('Execution Order', () => {
  function setup(targetHand: Card[], extra: { targetDown?: boolean; cheshire?: boolean } = {}) {
    const order = sp('execution-order');
    const s = makeState({
      players: [
        { hand: [order, ...filler(2)] },
        { hand: filler(2), down: !!extra.targetDown },
        { hand: targetHand },
      ],
      deck: deck(20),
      active: extra.cheshire ? [{ card: sp('cheshire-cat'), seat: 1 }] : [],
    });
    return { s: play(s, 0, order), order };
  }

  it('asks the player to declare a value', () => {
    expect(setup(filler(2)).s.prompts).toEqual([{ type: 'execution-declare', seat: 0 }]);
  });

  it('the next player draws 5 when they hold no card of that value', () => {
    const s = step(setup(filler(2)).s, { type: 'choose-value', seat: 0, value: 7 });
    expect(s.players[1].hand).toHaveLength(7);
    expect(s.players[0].hand).toHaveLength(2);
  });

  it('a matching card is forced onto the pile, they skip a turn and the user draws 5', () => {
    const r7 = num('R', 7);
    const order = sp('execution-order');
    let s = makeState({ players: [{ hand: [order, ...filler(2)] }, { hand: [r7, ...filler(2)] }, { hand: filler(2) }], deck: deck(20) });
    s = play(s, 0, order);
    s = step(s, { type: 'choose-value', seat: 0, value: 7 });
    expect(s.pile[s.pile.length - 1].card).toEqual(r7);
    expect(s.lastNumberSeat).toBe(1);
    expect(s.players[0].hand).toHaveLength(7);
    expect(s.current).toBe(2); // seat 1 skipped
  });

  it('a target holding two matches chooses which', () => {
    const r7 = num('R', 7);
    const w7 = num('W', 7);
    const order = sp('execution-order');
    let s = makeState({ players: [{ hand: [order, ...filler(2)] }, { hand: [r7, w7, ...filler(1)] }, { hand: filler(2) }], deck: deck(20) });
    s = play(s, 0, order);
    s = step(s, { type: 'choose-value', seat: 0, value: 7 });
    expect(s.prompts).toEqual([{ type: 'execution-choose', seat: 1, value: 7, bySeat: 0 }]);
    s = step(s, { type: 'choose-cards', seat: 1, cardIds: [w7.id] });
    expect(s.pile[s.pile.length - 1].card).toEqual(w7);
  });

  it('skips down players when finding the next player', () => {
    const s = step(setup(filler(2), { targetDown: true }).s, { type: 'choose-value', seat: 0, value: 7 });
    expect(s.players[1].hand).toHaveLength(2);
    expect(s.players[2].hand).toHaveLength(7);
  });

  it('has no effect on a Cheshire-immune next player', () => {
    const s = step(setup(filler(2), { cheshire: true }).s, { type: 'choose-value', seat: 0, value: 7 });
    expect(s.players[1].hand).toHaveLength(2);
    expect(s.players[0].hand).toHaveLength(2);
  });
});

describe('Dead Knights', () => {
  it('a newer Knight replaces the older one and each draws the user a card', () => {
    const red = sp('dead-red-knight');
    const white = sp('dead-white-knight');
    let s = makeState({ players: [{ hand: [red, ...filler(2)] }, { hand: [white, ...filler(2)] }, { hand: filler(3) }], deck: deck(6) });
    s = play(s, 0, red);
    expect(s.players[0].hand).toHaveLength(3);
    s = play(s, 1, white);
    expect(s.active.map((a) => a.card.name)).toEqual(['dead-white-knight']);
    expect(s.discard).toContainEqual(red);
    expect(s.players[1].hand).toHaveLength(3);
  });
});

describe('Wisdom of Caterpillar', () => {
  it('each player views the other hand in turn; Cheshire players cannot be chosen', () => {
    const cat = sp('caterpillar');
    let s = makeState({
      players: [{ hand: [cat, ...filler(2)] }, { hand: filler(2) }, { hand: filler(2) }],
      active: [{ card: sp('cheshire-cat'), seat: 2 }],
    });
    s = play(s, 0, cat);
    expect(s.prompts).toEqual([{ type: 'choose-player', seat: 0, purpose: 'caterpillar', options: [1] }]);
    expect(() => step(s, { type: 'choose-seat', seat: 0, target: 2 })).toThrow(IllegalActionError);
    s = step(s, { type: 'choose-seat', seat: 0, target: 1 });
    expect(s.prompts).toEqual([
      { type: 'view-hand', seat: 0, target: 1 },
      { type: 'view-hand', seat: 1, target: 0 },
    ]);
    s = step(s, { type: 'ack', seat: 0 });
    s = step(s, { type: 'ack', seat: 1 });
    expect(s.prompts).toEqual([]);
    expect(s.current).toBe(1);
  });
});

describe('Exile', () => {
  it('moves the chosen player, who draws a card', () => {
    const exile = sp('exile');
    let s = makeState({ players: [{ hand: [exile, ...filler(2)] }, { hand: filler(2), position: 'chess' }, { hand: filler(2) }], deck: deck(5) });
    s = play(s, 0, exile);
    expect(s.prompts[0]).toEqual({ type: 'choose-player', seat: 0, purpose: 'exile', options: [0, 1, 2] });
    s = step(s, { type: 'choose-seat', seat: 0, target: 1 });
    expect(s.prompts[0]).toEqual({ type: 'exile-location', seat: 0, target: 1 });
    expect(() => step(s, { type: 'choose-location', seat: 0, location: 'chess' })).toThrow(IllegalActionError);
    expect(() => step(s, { type: 'choose-location', seat: 0, location: null })).toThrow(IllegalActionError);
    s = step(s, { type: 'choose-location', seat: 0, location: 'red-queen' });
    expect(s.players[1].position).toBe('red-queen');
    expect(s.players[1].hand).toHaveLength(3);
  });

  it('can target yourself, and leaving the Black Forest discards your Shadow Creatures', () => {
    const exile = sp('exile');
    const shadow = { card: sp('shadow-creatures'), seat: 0 };
    let s = makeState({
      players: [{ hand: [exile, ...filler(2)], position: 'black-forest' }, { hand: filler(2) }, { hand: filler(2) }],
      active: [shadow],
      deck: deck(5),
    });
    // Shadow Creatures switches off the Black Forest action ban
    s = play(s, 0, exile);
    s = step(s, { type: 'choose-seat', seat: 0, target: 0 });
    s = step(s, { type: 'choose-location', seat: 0, location: 'mad-hatter' });
    expect(s.active).toEqual([]);
    expect(s.discard).toContainEqual(shadow.card);
  });
});

describe('location validation', () => {
  it('Exile rejects locations that do not exist and the Outskirts', () => {
    const exile = sp('exile');
    let s = makeState({ players: [{ hand: [exile, ...filler(2)] }, { hand: filler(2), position: 'chess' }, { hand: filler(2) }], deck: deck(5) });
    s = step(s, { type: 'play', seat: 0, cardId: exile.id });
    s = step(s, { type: 'choose-seat', seat: 0, target: 1 });
    expect(() => step(s, { type: 'choose-location', seat: 0, location: 'x' as never })).toThrow(IllegalActionError);
    expect(() => step(s, { type: 'choose-location', seat: 0, location: 'outskirts' as never })).toThrow(IllegalActionError);
  });
});
