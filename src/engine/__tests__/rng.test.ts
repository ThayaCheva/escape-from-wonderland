import { describe, expect, it } from 'vitest';
import { shuffle } from '../rng';
import { nextLocationClockwise } from '../board';

describe('rng and board', () => {
  it('shuffle is deterministic per seed and a permutation', () => {
    const [a] = shuffle([1, 2, 3, 4, 5, 6, 7, 8], 42);
    const [b] = shuffle([1, 2, 3, 4, 5, 6, 7, 8], 42);
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('nextLocationClockwise wraps red-queen to white-queen', () => {
    expect(nextLocationClockwise('red-queen')).toBe('white-queen');
    expect(nextLocationClockwise('white-queen')).toBe('mad-hatter');
  });
});
