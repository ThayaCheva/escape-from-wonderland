import { describe, expect, it } from 'vitest';
import { viewFor } from '../view';
import { newGame } from '../setup';
import { step } from '../step';
import { isNumber } from '../cards';
import { makeState, num, sp } from '../testkit';
import type { GameState } from '../types';

/** A 4-player game just past setup. */
function midGame(): GameState {
  let s = newGame({ playerCount: 4, seed: 21 });
  for (let seat = 0; seat < 4; seat++) {
    const pick = s.players[seat].hand.find(isNumber);
    s = step(s, { type: 'setup-pick', seat, cardId: pick ? pick.id : null });
  }
  return s;
}

describe('viewFor', () => {
  it('shares the last played card even after its log is gone and keeps the rest of the hand hidden', () => {
    const played = sp('tweedledee');
    const secret = num('W', 5);
    const initial = makeState({
      players: [{ position: 'white-queen', hand: [played, secret] }, { hand: [num('R', 7)] }],
    });
    const current = step(initial, { type: 'play', seat: 0, cardId: played.id });
    current.log = [];
    expect(current.discard).not.toContainEqual(played);
    const view = viewFor(current, 1);
    expect(view.lastPlayed).toEqual({ seat: 0, card: played });
    expect(JSON.stringify(view)).not.toContain(secret.id);
  });

  it('hides every other hand card and every deck card, but keeps your own hand', () => {
    const s = midGame();
    for (let v = 0; v < 4; v++) {
      const json = JSON.stringify(viewFor(s, v));
      for (let o = 0; o < 4; o++) {
        for (const c of s.players[o].hand) {
          if (o === v) expect(json).toContain(`"${c.id}"`);
          else expect(json).not.toContain(`"${c.id}"`);
        }
      }
      for (const c of s.deck) expect(json).not.toContain(`"${c.id}"`);
    }
  });

  it('keeps hand counts and deck size, and removes the seed', () => {
    const s = midGame();
    const v = viewFor(s, 2);
    expect(v.players.map((p) => p.hand.length)).toEqual(s.players.map((p) => p.hand.length));
    expect(v.deck).toHaveLength(s.deck.length);
    expect(v.seed).toBe(0);
    expect(v.players[0].hand[0]).toEqual({ id: 'hidden-0-0', kind: 'hidden' });
  });

  it("hides other players' setup picks until setup resolves", () => {
    let s = newGame({ playerCount: 3, seed: 5 });
    const pick0 = s.players[0].hand.find(isNumber)!;
    s = step(s, { type: 'setup-pick', seat: 0, cardId: pick0.id });
    expect(JSON.stringify(viewFor(s, 1))).not.toContain(pick0.id);
    expect(viewFor(s, 0).setupPicks).toEqual({ 0: pick0.id });
  });

  it("hides Vines' taken card from everyone but the taker", () => {
    const taken = num('R', 7);
    const s = makeState({ players: [{ hand: [num('W', 1)] }, { hand: [taken, num('W', 2)] }, { hand: [num('W', 3)] }] });
    s.prompts = [{ type: 'vines-give', seat: 1, target: 0, takenCardId: taken.id }];
    expect(viewFor(s, 0).prompts[0]).toMatchObject({ takenCardId: '' });
    expect(viewFor(s, 1).prompts[0]).toMatchObject({ takenCardId: taken.id });
    expect(JSON.stringify(viewFor(s, 2))).not.toContain(taken.id);
  });

  it("shows a Caterpillar target's hand to the viewer only", () => {
    const secret = [num('R', 4), num('R', 5)];
    const s = makeState({ players: [{ hand: [num('W', 1)] }, { hand: [num('W', 2)] }, { hand: [num('W', 3)] }, { hand: secret }] });
    s.prompts = [{ type: 'view-hand', seat: 1, target: 3 }];
    expect(viewFor(s, 1).players[3].hand).toEqual(secret);
    expect(JSON.stringify(viewFor(s, 2))).not.toContain(secret[0].id);
  });

  it('does not change the state it was given', () => {
    const s = midGame();
    const before = structuredClone(s);
    viewFor(s, 1);
    expect(s).toEqual(before);
  });
});
