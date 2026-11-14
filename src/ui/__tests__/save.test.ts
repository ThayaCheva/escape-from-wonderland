import { describe, expect, it } from 'vitest';
import { loadGame, saveGame, SAVE_KEY, type SaveStorage } from '../save';
import { newGame } from '../../engine/setup';

function memory(initial: Record<string, string> = {}): SaveStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

describe('save', () => {
  it('round-trips a saved game', () => {
    const store = memory();
    const s = newGame({ playerCount: 4, seed: 3 });
    saveGame(s, store);
    expect(loadGame(store)).toEqual(s);
  });

  it.each([
    ['invalid JSON', '{not json'],
    ['an old version', JSON.stringify({ version: 0 })],
    ['a save without players', JSON.stringify({ version: 1, prompts: [] })],
    ['a save without prompts', JSON.stringify({ version: 1, players: [] })],
    ['a save with no players', JSON.stringify({ version: 1, players: [], prompts: [] })],
    ['a save missing the deck', JSON.stringify((({ deck: _d, ...rest }) => rest)(newGame({ playerCount: 3, seed: 2 })))],
    ['a save whose current seat is out of range', JSON.stringify({ ...newGame({ playerCount: 3, seed: 2 }), current: 5 })],
    ['a save with a player missing a hand', JSON.stringify((() => { const g = newGame({ playerCount: 3, seed: 2 }) as unknown as { players: Record<string, unknown>[] }; delete g.players[1].hand; return g; })())],
  ])('discards %s', (_label, raw) => {
    const store = memory({ [SAVE_KEY]: raw });
    expect(loadGame(store)).toBeNull();
    expect(store.data[SAVE_KEY]).toBeUndefined();
  });

  it('round-trips a 2-player game', () => {
    const store = memory();
    const s = newGame({ playerCount: 2, seed: 4 });
    saveGame(s, store);
    expect(loadGame(store)).toEqual(s);
  });

  it('returns null when nothing is saved', () => {
    expect(loadGame(memory())).toBeNull();
  });

  it('returns null when storage throws', () => {
    const broken: SaveStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadGame(broken)).toBeNull();
    expect(() => saveGame(newGame({ playerCount: 3, seed: 1 }), broken)).not.toThrow();
  });
});
