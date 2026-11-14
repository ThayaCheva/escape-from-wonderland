import { describe, expect, it } from 'vitest';
import { newGame } from '../setup';
import { step } from '../step';
import { makeRand, randomAction, totalCards } from './randomPlayer';

describe('random play', () => {
  it('200 seeded random games never stall and conserve 142 cards', () => {
    let finished = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const rand = makeRand(seed * 7919);
      let s = newGame({ playerCount: seed % 2 ? 4 : 3, seed });
      for (let i = 0; i < 3000 && s.phase !== 'game-over'; i++) {
        const action = randomAction(s, rand);
        if (!action) throw new Error(`seed ${seed}: no legal action for prompt ${JSON.stringify(s.prompts[0])}`);
        try {
          s = step(s, action);
        } catch (e) {
          throw new Error(`seed ${seed} step ${i}: ${(e as Error).message} for ${JSON.stringify(action)} prompt ${JSON.stringify(s.prompts[0])}`);
        }
        if (totalCards(s) !== 142) throw new Error(`seed ${seed} step ${i}: ${totalCards(s)} cards after ${JSON.stringify(action)}`);
      }
      if (s.phase === 'game-over') finished++;
    }
    // sanity: most random games should actually end
    expect(finished).toBeGreaterThan(100);
  }, 180_000);
});
