import { useCallback, useState } from 'react';
import { newGame } from '../engine/setup';
import { IllegalActionError, step } from '../engine/step';
import type { GameAction, GameState } from '../engine/types';
import { clearSave, loadGame, saveGame } from './save';

export interface StartOptions {
  playerCount: 3 | 4;
  names: string[];
}

export function useGame() {
  const [state, setState] = useState<GameState | null>(null);

  const start = useCallback((opts: StartOptions) => {
    const s = newGame({ playerCount: opts.playerCount, names: opts.names, seed: Date.now() >>> 0 });
    saveGame(s);
    setState(s);
  }, []);

  const resume = useCallback(() => {
    const s = loadGame();
    if (s) setState(s);
    return s !== null;
  }, []);

  /** Applies an action. Returns an error message for an illegal action, else null. */
  const dispatch = useCallback(
    (action: GameAction): string | null => {
      if (!state) return null;
      try {
        const next = step(state, action);
        if (next.phase === 'game-over') clearSave();
        else saveGame(next);
        setState(next);
        return null;
      } catch (e) {
        if (e instanceof IllegalActionError) return e.message;
        throw e;
      }
    },
    [state],
  );

  const quit = useCallback(() => setState(null), []);

  return { state, start, resume, dispatch, quit };
}
