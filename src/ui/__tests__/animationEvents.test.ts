import { describe, expect, it } from 'vitest';
import { detectAnimations, locationInfo, newLogLines, pickedSeats } from '../animationEvents';
import { makeState, num, sp } from '../../engine/testkit';
import type { GameState } from '../../engine/types';

const names = () => makeState({ players: [{ name: 'Ann' }, { name: 'Sam' }, { name: 'Kim' }] });
function after(prev: GameState, lines: string[], change: (s: GameState) => void = () => {}): GameState {
  const next = structuredClone(prev);
  next.log = [...prev.log, ...lines];
  change(next);
  return next;
}

describe('newLogLines', () => {
  it('returns the lines added since last time', () => {
    expect(newLogLines(['a', 'b'], ['a', 'b', 'c', 'd'])).toEqual(['c', 'd']);
    expect(newLogLines(['a'], ['a'])).toEqual([]);
  });

  it('still works once the log is capped and old lines drop off the front', () => {
    const prev = Array.from({ length: 200 }, (_, i) => `l${i}`);
    const next = [...prev.slice(3), 'x', 'y', 'z'];
    expect(newLogLines(prev, next)).toEqual(['x', 'y', 'z']);
  });

  it('treats an unrelated log as nothing new', () => {
    expect(newLogLines(null, ['a', 'b'])).toEqual([]);
  });
});

describe('detectAnimations', () => {
  it('announces special cards, not number cards', () => {
    const prev = names();
    const next = after(prev, ['Sam plays Exile.', 'Kim plays Red 9 (Red Queen\'s Castle: counts as 10).']);
    expect(detectAnimations(prev, next)).toEqual([{ kind: 'special', seat: 1, name: 'exile' }]);
  });

  it('finds draws, including the Jabberwocky and the start of a round', () => {
    const prev = names();
    const next = after(prev, ['Ann draws 5 cards.', 'The Jabberwocky makes Kim draw a card.', 'Sam draws 1 card.']);
    expect(detectAnimations(prev, next)).toEqual([
      { kind: 'draw', seat: 0, count: 5 },
      { kind: 'draw', seat: 2, count: 1 },
      { kind: 'draw', seat: 1, count: 1 },
    ]);
  });

  it('finds discards with one card per name listed', () => {
    const prev = names();
    const next = after(prev, ["Kim discards Red 2, White Queen's Generosity."]);
    expect(detectAnimations(prev, next)).toEqual([{ kind: 'discard', seat: 2, count: 2 }]);
  });

  it('finds hand changes, slaying and passing', () => {
    const prev = names();
    const next = after(prev, [
      'Hands pass to the right.',
      'Ann and Kim swap a card.',
      "Sam and Ann look at each other's hands.",
      'Ann slays Jabberwocky.',
      'Kim passes.',
    ]);
    expect(detectAnimations(prev, next)).toEqual([
      { kind: 'party' },
      { kind: 'swap', a: 0, b: 2 },
      { kind: 'peek', a: 1, b: 0 },
      { kind: 'slay', title: 'Jabberwocky' },
      { kind: 'down', seat: 2 },
    ]);
  });

  it('a new round sweeps the pile and announces who starts', () => {
    const prev = names();
    prev.pile = [{ card: num('R', 9), seat: 0, effective: 9, modifier: 0 }];
    const next = after(prev, ['Round 2 begins. Everyone draws a card.'], (s) => {
      s.round = 2;
      s.current = 2;
      s.pile = [];
    });
    expect(detectAnimations(prev, next)).toEqual([
      { kind: 'sweep' },
      { kind: 'round', round: 2, starter: 2 },
      { kind: 'turn', seat: 2 },
    ]);
  });

  it('the turn passing to someone else is a turn change', () => {
    const prev = names();
    const next = after(prev, ['Ann passes.'], (s) => (s.current = 1));
    expect(detectAnimations(prev, next)).toEqual([
      { kind: 'down', seat: 0 },
      { kind: 'turn', seat: 1 },
    ]);
  });

  it('setup finishing reveals the picks and starts round 1', () => {
    const prev = names();
    prev.phase = 'setup';
    prev.round = 0;
    const next = after(prev, ['Revealed: …', 'Kim goes first.'], (s) => {
      s.phase = 'playing';
      s.round = 1;
      s.current = 2;
    });
    expect(detectAnimations(prev, next)).toEqual([
      { kind: 'reveal' },
      { kind: 'round', round: 1, starter: 2 },
      { kind: 'turn', seat: 2 },
    ]);
  });

  it('a win is announced once', () => {
    const prev = names();
    const next = after(prev, ['Sam escapes Wonderland!'], (s) => {
      s.phase = 'game-over';
      s.winner = 1;
    });
    expect(detectAnimations(prev, next)).toEqual([{ kind: 'win', seat: 1 }]);
  });

  it('nothing on the very first view', () => {
    expect(detectAnimations(null, names())).toEqual([]);
  });
});

describe('pickedSeats', () => {
  it('lists players who have already chosen a starting card', () => {
    const s = names();
    s.phase = 'setup';
    s.prompts = [{ type: 'setup-pick', seat: 2 }];
    expect(pickedSeats(s)).toEqual([0, 1]);
    s.phase = 'playing';
    expect(pickedSeats(s)).toEqual([]);
  });
});

describe('locationInfo', () => {
  it('names the effect and the Events that can be played there', () => {
    const s = names();
    expect(locationInfo(s, 'mad-hatter')).toEqual({
      name: "Mad Hatter's Place",
      effect: 'Number cards you play ignore the colour rule.',
      events: ["Mad Hatter's Party", 'Tea of Confusion'],
      off: false,
    });
  });

  it('says when Shadow Creatures has switched location effects off', () => {
    const s = names();
    s.active = [{ card: sp('shadow-creatures'), seat: 1 }];
    expect(locationInfo(s, 'chess').off).toBe(true);
  });
});
