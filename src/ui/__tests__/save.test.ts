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
  ])('discards %s', (_label, raw) => {
    const store = memory({ [SAVE_KEY]: raw });
    expect(loadGame(store)).toBeNull();
    expect(store.data[SAVE_KEY]).toBeUndefined();
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
