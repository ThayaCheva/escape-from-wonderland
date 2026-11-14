import { describe, expect, it } from 'vitest';
import {
  checkPlay,
  colorRule,
  isImmune,
  locationEffectsOn,
  modifierFor,
  nextUpSeat,
} from '../rules';
import { makeState, num, pileOf, sp } from '../testkit';
import type { Card, GameState, Player } from '../types';

function withHand(cards: Card[], extra: Partial<Player> = {}, opts: Partial<Parameters<typeof makeState>[0]> = {}) {
  return makeState({ players: [{ hand: cards, ...extra }, {}, {}, {}], ...opts });
}
const reason = (s: GameState, cardId: string, free = false) => {
  const r = checkPlay(s, 0, cardId, { free });
  return r.ok ? 'ok' : r.reason;
};

describe('number legality', () => {
  it('any number card is fine on an empty pile', () => {
    const c = num('W', 1);
    expect(reason(withHand([c]), c.id)).toBe('ok');
  });

  it('checks value and alternate colour against the top card', () => {
    const top = pileOf(num('W', 9), 1);
    const cards = { r9: num('R', 9), r10: num('R', 10), r8: num('R', 8), w12: num('W', 12), w8: num('W', 8) };
    const s = withHand(Object.values(cards), {}, { pile: [top] });
    expect(reason(s, cards.r9.id)).toBe('ok');
    expect(reason(s, cards.r10.id)).toBe('ok');
    expect(reason(s, cards.r8.id)).toBe('Must be at least 9.');
    expect(reason(s, cards.w12.id)).toBe('Must be Red.');
    expect(reason(s, cards.w8.id)).toBe('Must be Red and at least 9.');
  });

  it("Red Queen's Castle adds 1", () => {
    const r8 = num('R', 8);
    const s = withHand([r8], { position: 'red-queen' }, { pile: [pileOf(num('W', 9), 1)] });
    expect(modifierFor(s, 0)).toBe(1);
    expect(reason(s, r8.id)).toBe('ok');
  });

  it("White Queen's Castle subtracts 1", () => {
    const r9 = num('R', 9);
    const s = withHand([r9], { position: 'white-queen' }, { pile: [pileOf(num('W', 9), 1)] });
    expect(modifierFor(s, 0)).toBe(-1);
    expect(reason(s, r9.id)).toBe('Must be at least 9.');
  });

  it("Mad Hatter's Place ignores colour", () => {
    const w10 = num('W', 10);
    const s = withHand([w10], { position: 'mad-hatter' }, { pile: [pileOf(num('W', 9), 1)] });
    expect(reason(s, w10.id)).toBe('ok');
  });

  it('a Dead Red Knight forces red', () => {
    const r6 = num('R', 6);
    const w6 = num('W', 6);
    const s = withHand([r6, w6], {}, { pile: [pileOf(num('R', 5), 1)], active: [{ card: sp('dead-red-knight'), seat: 1 }] });
    expect(reason(s, r6.id)).toBe('ok');
    expect(reason(s, w6.id)).toBe('Must be Red.');
  });

  it("Mad Hatter's Place ignores a Knight's lock", () => {
    const w6 = num('W', 6);
    const s = withHand([w6], { position: 'mad-hatter' }, { pile: [pileOf(num('R', 5), 1)], active: [{ card: sp('dead-red-knight'), seat: 1 }] });
    expect(reason(s, w6.id)).toBe('ok');
  });

  it("Cheshire Cat ignores another player's Knight lock", () => {
    const r6 = num('R', 6);
    const w6 = num('W', 6);
    const s = withHand([r6, w6], {}, {
      pile: [pileOf(num('R', 5), 1)],
      active: [{ card: sp('dead-red-knight'), seat: 1 }, { card: sp('cheshire-cat'), seat: 0 }],
    });
    expect(reason(s, r6.id)).toBe('Must be White.');
    expect(reason(s, w6.id)).toBe('ok');
  });

  it('the newest Knight sets the colour', () => {
    const s = withHand([], {}, {
      pile: [pileOf(num('R', 5), 1)],
      active: [{ card: sp('dead-red-knight'), seat: 1 }, { card: sp('dead-white-knight'), seat: 2 }],
    });
    expect(colorRule(s, 0)).toEqual({ mode: 'must', color: 'white' });
  });
});

describe('locations and immunity', () => {
  it('Shadow Creatures switches location effects off', () => {
    const exile = sp('exile');
    const shadow = { card: sp('shadow-creatures'), seat: 1 };
    expect(modifierFor(withHand([], { position: 'red-queen' }, { active: [shadow] }), 0)).toBe(0);
    expect(reason(withHand([exile], { position: 'black-forest' }, { active: [shadow] }), exile.id)).toBe('ok');
    expect(isImmune(withHand([], { position: 'chess' }, { active: [shadow] }), 0, { kind: 'event', bySeat: 1 })).toBe(false);
  });

  it("Cheshire Cat keeps location effects on against another player's Shadow Creatures only", () => {
    const cheshire = { card: sp('cheshire-cat'), seat: 0 };
    const others = withHand([], {}, { active: [{ card: sp('shadow-creatures'), seat: 1 }, cheshire] });
    expect(locationEffectsOn(others, 0)).toBe(true);
    const own = withHand([], {}, { active: [{ card: sp('shadow-creatures'), seat: 0 }, cheshire] });
    expect(locationEffectsOn(own, 0)).toBe(false);
  });

  it('immunity sources', () => {
    const chess = withHand([], { position: 'chess' });
    expect(isImmune(chess, 0, { kind: 'action', bySeat: 1 })).toBe(false);
    expect(isImmune(chess, 0, { kind: 'event', bySeat: 1 })).toBe(true);
    const cat = withHand([], {}, { active: [{ card: sp('cheshire-cat'), seat: 0 }] });
    expect(isImmune(cat, 0, { kind: 'action', bySeat: 1 })).toBe(true);
    expect(isImmune(cat, 0, { kind: 'action', bySeat: 0 })).toBe(false);
  });

  it('Black Forest bans actions and events need their location', () => {
    const exile = sp('exile');
    const vines = sp('vines');
    expect(reason(withHand([exile], { position: 'black-forest' }), exile.id)).toBe('No Action cards in the Black Forest.');
    expect(reason(withHand([vines, num('R', 1)], { position: 'chess' }), vines.id)).toBe('Only playable at the Black Forest.');
  });
});

describe('card-specific playability', () => {
  it('Drink Me lock allows only number cards', () => {
    const r1 = num('R', 1);
    const exile = sp('exile');
    const s = withHand([r1, exile], { drinkMeLock: 'active' });
    expect(reason(s, r1.id)).toBe('ok');
    expect(reason(s, exile.id)).toBe('Drink Me: only number cards this turn.');
  });

  it('Vorpal Sword needs something other than a Cheshire Cat to slay', () => {
    const sword = sp('vorpal-sword');
    expect(reason(withHand([sword], {}, { active: [{ card: sp('cheshire-cat'), seat: 1 }] }), sword.id)).toBe('Nothing to slay.');
    expect(reason(withHand([sword], {}, { active: [{ card: sp('jabberwocky'), seat: 1 }] }), sword.id)).toBe('ok');
  });

  it('only one Cheshire Cat per round', () => {
    const cat = sp('cheshire-cat');
    const s = withHand([cat]);
    s.cheshireUsedThisRound = true;
    expect(reason(s, cat.id)).toBe('Only one Cheshire Cat per round.');
  });

  it('Vines needs a swap card and a target', () => {
    const vines = sp('vines');
    const alone = makeState({ players: [{ hand: [vines], position: 'black-forest' }, { hand: [num('R', 2)] }, {}, {}] });
    expect(reason(alone, vines.id)).toBe('You need a card to swap.');
    const vines2 = sp('vines');
    const allChess = makeState({
      players: [
        { hand: [vines2, num('R', 1)], position: 'black-forest' },
        { hand: [num('R', 2)], position: 'chess' },
        { hand: [num('R', 3)], position: 'chess' },
        { hand: [num('R', 4)], position: 'chess' },
      ],
    });
    expect(reason(allChess, vines2.id)).toBe('No one to target.');
  });

  it('free plays ignore value and colour but Drink Me cannot be an extra', () => {
    const w2 = num('W', 2);
    const drink = sp('drink-me');
    const s = withHand([w2, drink], {}, { pile: [pileOf(num('W', 13), 1)] });
    expect(reason(s, w2.id, true)).toBe('ok');
    expect(reason(s, drink.id, true)).toBe("Drink Me can't be played as an extra card.");
  });

  it('a card not in hand is rejected', () => {
    expect(reason(withHand([]), 'nope')).toBe("That card isn't in your hand.");
  });
});

describe('seats', () => {
  it('nextUpSeat skips down players and returns null when everyone else is down', () => {
    const s = makeState({ players: [{}, { down: true }, {}, {}] });
    expect(nextUpSeat(s, 0)).toBe(2);
    const allDown = makeState({ players: [{}, { down: true }, { down: true }, { down: true }] });
    expect(nextUpSeat(allDown, 0)).toBeNull();
  });
});

describe('review fixes', () => {
  it("a Dead Knight's colour lock also applies on an empty pile", () => {
    const w3 = num('W', 3);
    const r3 = num('R', 3);
    const s = withHand([w3, r3], {}, { active: [{ card: sp('dead-red-knight'), seat: 1 }] });
    expect(reason(s, w3.id)).toBe('Must be Red.');
    expect(reason(s, r3.id)).toBe('ok');
    expect(colorRule(s, 0)).toEqual({ mode: 'must', color: 'red' });
  });

  it("on an empty pile, Mad Hatter's Place and Cheshire still ignore the lock", () => {
    const w3 = num('W', 3);
    const hatter = withHand([w3], { position: 'mad-hatter' }, { active: [{ card: sp('dead-red-knight'), seat: 1 }] });
    expect(reason(hatter, w3.id)).toBe('ok');
    const w4 = num('W', 4);
    const cat = withHand([w4], {}, { active: [{ card: sp('dead-red-knight'), seat: 1 }, { card: sp('cheshire-cat'), seat: 0 }] });
    expect(reason(cat, w4.id)).toBe('ok');
  });
});
