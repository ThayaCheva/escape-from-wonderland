import { IllegalActionError } from './errors';
import { checkSetupPick, resolveSetup } from './setup';
import type { GameAction, GameState, Seat } from './types';

export { IllegalActionError };

export function actingSeat(state: GameState): Seat {
  return state.prompts[0]?.seat ?? state.current;
}

function illegal(msg: string): never {
  throw new IllegalActionError(msg);
}

export function step(state: GameState, action: GameAction): GameState {
  if (state.phase === 'game-over') illegal('The game is over.');
  if (action.seat !== actingSeat(state)) illegal("It isn't your turn.");
  const s = structuredClone(state);
  const prompt = s.prompts[0];

  if (prompt?.type === 'setup-pick') {
    if (action.type !== 'setup-pick') illegal('Choose your starting card.');
    const err = checkSetupPick(s, action.seat, action.cardId);
    if (err) illegal(err);
    s.setupPicks[action.seat] = action.cardId;
    s.prompts.shift();
    if (s.prompts.length === 0) {
      const starter = resolveSetup(s);
      if (starter !== null) s.current = starter;
    }
    return s;
  }

  illegal('That action is not available right now.');
}
