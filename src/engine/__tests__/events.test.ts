import { describe, expect, it } from 'vitest';
import { step, IllegalActionError } from '../step';
import { endRound } from '../flow';
import { locationEffectsOn } from '../rules';
import { makeState, num, sp } from '../testkit';
import type { Card, GameState, LocationId, Player } from '../types';

const filler = (n: number): Card[] => Array.from({ length: n }, (_, i) => num('R', 13 - (i % 3)));
const deck = (n: number) => Array.from({ length: n }, () => num('W', 1));

function playEvent(name: Parameters<typeof sp>[0], at: LocationId, others: Array<Partial<Player>>, opts: { deckSize?: number; userHand?: Card[] } = {}) {
  const card = sp(name);
  const s = makeState({
    players: [{ hand: [card, ...(opts.userHand ?? filler(3))], position: at }, ...others],
    deck: deck(opts.deckSize ?? 20),
  });
  return { s: step(s, { type: 'play', seat: 0, cardId: card.id }), card };
}

describe("White Queen's Generosity", () => {
  it('every non-immune player with cards discards one, starting with the user', () => {
    const { s } = playEvent('wq-generosity', 'white-queen', [{ hand: filler(2) }, { hand: filler(2), position: 'chess' }, { hand: [] }]);
    expect(s.prompts.map((p) => p.seat)).toEqual([0, 1]);
    expect(s.prompts[0]).toMatchObject({ type: 'discard', min: 1, max: 1 });
    expect(() => step(s, { type: 'choose-cards', seat: 0, cardIds: [] })).toThrow(IllegalActionError);
  });
});

describe('Tweedledee and Tweedledum', () => {
  it('pair up across players and each may discard up to 2', () => {
    const dee = sp('tweedledee');
    const dum = sp('tweedledum');
    let s = makeState({
      players: [{ hand: [dee, ...filler(3)], position: 'white-queen' }, { hand: [dum, ...filler(3)], position: 'white-queen' }, { hand: filler(3) }],
    });
    s = step(s, { type: 'play', seat: 0, cardId: dee.id });
    expect(s.active.map((a) => a.card.name)).toEqual(['tweedledee']);
    s = step(s, { type: 'play', seat: 1, cardId: dum.id });
    expect(s.active).toEqual([]);
    expect(s.discard).toEqual(expect.arrayContaining([dee, dum]));
    expect(s.prompts).toEqual([
      expect.objectContaining({ type: 'discard', seat: 1, min: 0, max: 2 }),
      expect.objectContaining({ type: 'discard', seat: 0, min: 0, max: 2 }),
    ]);
  });

  it('one player playing both may discard up to 4', () => {
    const dee = sp('tweedledee');
    const dum = sp('tweedledum');
    let s = makeState({ players: [{ hand: [dee, dum, ...filler(5)], position: 'white-queen' }, { hand: filler(3) }, { hand: filler(3) }] });
    s = step(s, { type: 'play', seat: 0, cardId: dee.id });
    s = step(s, { type: 'pass', seat: 1 });
    s.current = 0; // hand-built: back to seat 0 without ending the round
    s.turnActionTaken = false;
    s = step(s, { type: 'play', seat: 0, cardId: dum.id });
    expect(s.prompts).toEqual([expect.objectContaining({ type: 'discard', seat: 0, min: 0, max: 4 })]);
  });

  it('pairs with the earliest waiting partner', () => {
    const dee1 = { card: sp('tweedledee'), seat: 1 };
    const dee2 = { card: sp('tweedledee'), seat: 2 };
    const dum = sp('tweedledum');
    let s = makeState({ players: [{ hand: [dum, ...filler(3)], position: 'white-queen' }, { hand: filler(3) }, { hand: filler(3) }], active: [dee1, dee2] });
    s = step(s, { type: 'play', seat: 0, cardId: dum.id });
    expect(s.active).toEqual([dee2]);
    expect(s.prompts.map((p) => p.seat)).toEqual([0, 1]);
  });

  it('an unpaired Tweedle is discarded when the round ends', () => {
    const dee = { card: sp('tweedledee'), seat: 1 };
    const s = makeState({ players: [{ hand: filler(2) }, { hand: filler(2) }, { hand: filler(2) }], active: [dee], deck: deck(5) });
    s.roundEnding = { starter: 0 };
    endRound(s);
    expect(s.active).toEqual([]);
    expect(s.discard).toContainEqual(dee.card);
  });
});

describe('Jabberwocky', () => {
  it('stacks: two make non-immune players draw 2 at the start of each turn; the owner on Chess draws none', () => {
    const j1 = { card: sp('jabberwocky'), seat: 0 };
    const j2 = { card: sp('jabberwocky'), seat: 0 };
    let s = makeState({
      players: [{ hand: filler(3), position: 'chess' }, { hand: filler(3) }, { hand: filler(3) }],
      active: [j1, j2],
      deck: deck(10),
    });
    s = step(s, { type: 'pass', seat: 0 });
    expect(s.players[1].hand).toHaveLength(5);
    s = step(s, { type: 'pass', seat: 1 }); // round ends: 0 and 1 down, 2 standing
    // round 2 starts with seat 2; jabberwockies were cleared by the round end
    expect(s.active).toEqual([]);
    const t = makeState({ players: [{ hand: filler(3) }, { hand: filler(3) }, { hand: filler(3), position: 'chess' }], active: [j1], deck: deck(10), current: 1 });
    const u = step(t, { type: 'pass', seat: 1 });
    expect(u.players[2].hand).toHaveLength(3);
  });
});

describe("Mad Hatter's Party", () => {
  it('hands pass to the previous non-immune player; immune players keep theirs', () => {
    const h1 = filler(2);
    const h2 = filler(3);
    const h3 = filler(4);
    const { s } = playEvent('mh-party', 'mad-hatter', [{ hand: h1 }, { hand: h2, position: 'chess' }, { hand: h3 }], { userHand: filler(1) });
    const h0 = s.players[0].hand; // unchanged reference check below uses lengths
    expect(s.players[0].hand).toEqual(h1); // seat 1's old hand → seat 0
    expect(s.players[1].hand).toEqual(h3); // seat 3's old hand → seat 1
    expect(s.players[2].hand).toEqual(h2); // immune
    expect(s.players[3].hand).toHaveLength(1); // seat 0's old hand (1 card after playing the Party)
    expect(h0).toBeDefined();
  });
});

describe('Tea of Confusion', () => {
  it('discard up to 2 then draw 2, and discarding to zero does not win', () => {
    const { s: s0 } = playEvent('tea-of-confusion', 'mad-hatter', [{ hand: filler(2) }, { hand: filler(2) }], { userHand: filler(2) });
    expect(s0.prompts.map((p) => p.seat)).toEqual([0, 1, 2]);
    let s = step(s0, { type: 'choose-cards', seat: 0, cardIds: s0.players[0].hand.map((c) => c.id) });
    expect(s.players[0].hand).toHaveLength(2);
    expect(() => step(s, { type: 'choose-cards', seat: 1, cardIds: s.players[1].hand.concat(s.players[1].hand).map((c) => c.id).slice(0, 3) })).toThrow(IllegalActionError);
    s = step(s, { type: 'choose-cards', seat: 1, cardIds: [] });
    s = step(s, { type: 'choose-cards', seat: 2, cardIds: [s.players[2].hand[0].id] });
    expect(s.phase).toBe('playing');
    expect(s.players.map((p) => p.hand.length)).toEqual([2, 4, 3]);
  });
});

describe('Rabbit Hole', () => {
  it('moves everyone on a location one step clockwise', () => {
    const shadow = { card: sp('shadow-creatures'), seat: 2 };
    const card = sp('rabbit-hole');
    let s = makeState({
      players: [
        { hand: [card, ...filler(2)], position: 'red-queen' },
        { hand: filler(2) },
        { hand: filler(2), position: 'black-forest' },
        { hand: filler(2), position: 'chess' },
      ],
      active: [shadow],
    });
    s = step(s, { type: 'play', seat: 0, cardId: card.id });
    // Shadow Creatures (seat 2) switches off Chess immunity for everyone, so seat 3 moves too
    expect(s.players.map((p) => p.position)).toEqual(['white-queen', 'outskirts', 'chess', 'red-queen']);
    expect(s.active).toEqual([]);
  });

  it('a Chess player stays put when location effects are on', () => {
    const { s } = playEvent('rabbit-hole', 'red-queen', [{ hand: filler(2), position: 'chess' }, { hand: filler(2), position: 'mad-hatter' }]);
    expect(s.players.map((p) => p.position)).toEqual(['white-queen', 'chess', 'black-forest']);
  });
});

describe("Red Queen's Decree", () => {
  it('every non-immune player draws one, including the user', () => {
    const { s } = playEvent('rq-decree', 'red-queen', [{ hand: filler(2) }, { hand: filler(2), position: 'chess' }]);
    expect(s.players.map((p) => p.hand.length)).toEqual([4, 3, 2]);
  });
});

describe('Shadow Creatures', () => {
  it('with two copies, location effects stay off while either remains', () => {
    const a = { card: sp('shadow-creatures'), seat: 1 };
    const b = { card: sp('shadow-creatures'), seat: 2 };
    const s: GameState = makeState({ players: [{ position: 'red-queen' }, { position: 'black-forest' }, { position: 'black-forest' }], active: [a, b] });
    s.active = [b];
    expect(locationEffectsOn(s, 0)).toBe(false);
    s.active = [];
    expect(locationEffectsOn(s, 0)).toBe(true);
  });

  it('playing it puts it in the active area', () => {
    const { s, card } = playEvent('shadow-creatures', 'black-forest', [{ hand: filler(2) }, { hand: filler(2) }]);
    expect(s.active).toEqual([{ card, seat: 0 }]);
  });
});

describe('Vines of the Black Forest', () => {
  it('takes a blind card from the target and gives one back', () => {
    const give = num('W', 1);
    const theirs = [num('R', 7), num('R', 8)];
    const { s: s0 } = playEvent('vines', 'black-forest', [{ hand: theirs }, { hand: filler(2), position: 'chess' }], { userHand: [give, ...filler(1)] });
    expect(s0.prompts).toEqual([{ type: 'choose-player', seat: 0, purpose: 'vines', options: [1] }]);
    let s = step(s0, { type: 'choose-seat', seat: 0, target: 1 });
    expect(s.prompts).toEqual([{ type: 'vines-take', seat: 0, target: 1 }]);
    s = step(s, { type: 'choose-hand-index', seat: 0, index: 0 });
    const taken = theirs[0];
    expect(s.prompts).toEqual([{ type: 'vines-give', seat: 0, target: 1, takenCardId: taken.id }]);
    expect(() => step(s, { type: 'choose-cards', seat: 0, cardIds: [taken.id] })).toThrow(IllegalActionError);
    s = step(s, { type: 'choose-cards', seat: 0, cardIds: [give.id] });
    expect(s.players[0].hand).toContainEqual(taken);
    expect(s.players[1].hand).toContainEqual(give);
    expect(s.log.join(' ')).not.toContain('Red 7');
  });
});
