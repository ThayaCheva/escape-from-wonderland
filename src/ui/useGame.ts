import { useCallback, useEffect, useState } from 'react';
import { newGame } from '../engine/setup';
import { IllegalActionError, step } from '../engine/step';
import type { CardName, GameAction, GameState, Position } from '../engine/types';
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

  // Dev-only playtest helpers: __debugGive(seat, 'jabberwocky') and __debugMove(seat, 'chess').
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as Record<string, unknown>;
    w.__debugGive = (seat: number, name: CardName) =>
      setState((prev) => {
        if (!prev) return prev;
        const s = structuredClone(prev);
        const from = [s.deck, s.discard, ...s.players.filter((_, i) => i !== seat).map((p) => p.hand)];
        for (const pile of from) {
          const i = pile.findIndex((c) => c.kind !== 'number' && c.name === name);
          if (i >= 0) {
            s.players[seat].hand.push(pile.splice(i, 1)[0]);
            return s;
          }
        }
        return prev;
      });
    w.__debugMove = (seat: number, pos: Position) =>
      setState((prev) => {
        if (!prev) return prev;
        const s = structuredClone(prev);
        s.players[seat].position = pos;
        return s;
      });
  }, []);

  return { state, start, resume, dispatch, quit };
}
