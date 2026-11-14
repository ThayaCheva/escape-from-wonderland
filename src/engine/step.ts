import { IllegalActionError } from './errors';
import { checkSetupPick, resolveSetup } from './setup';
import { settle, startTurn } from './flow';
import { playCard } from './play';
import { log, moveToken, nameOf } from './mutate';
import { ACTION_PROMPT_HANDLERS } from './effects/actions';
import { EVENT_PROMPT_HANDLERS } from './effects/events';
import type { PromptHandlers } from './effects/handlers';
import type { GameAction, GameState, Prompt, Seat } from './types';

export { IllegalActionError };

export function actingSeat(state: GameState): Seat {
  return state.prompts[0]?.seat ?? state.current;
}

function illegal(msg: string): never {
  throw new IllegalActionError(msg);
}

function handlePrompt(s: GameState, prompt: Prompt, action: GameAction): void {
  if (prompt.type === 'setup-pick') {
    if (action.type !== 'setup-pick') illegal('Choose your starting card.');
    const err = checkSetupPick(s, action.seat, action.cardId);
    if (err) illegal(err);
    s.setupPicks[action.seat] = action.cardId;
    s.prompts.shift();
    if (s.prompts.length === 0) {
      const starter = resolveSetup(s);
      if (starter !== null) startTurn(s, starter);
    }
    return;
  }
  if (prompt.type === 'round-end-move') {
    if (action.type !== 'choose-location') illegal('Choose where to move, or stay.');
    s.prompts.shift();
    if (action.location === null || action.location === s.players[prompt.seat].position) {
      log(s, `${nameOf(s, prompt.seat)} stays where they are.`);
    } else {
      moveToken(s, prompt.seat, action.location);
    }
    return;
  }
  const handlers: PromptHandlers = { ...ACTION_PROMPT_HANDLERS, ...EVENT_PROMPT_HANDLERS };
  const handler = handlers[prompt.type] as ((s: GameState, p: Prompt, a: GameAction) => void) | undefined;
  if (!handler) illegal('That action is not available right now.');
  handler(s, prompt, action);
}

export function step(state: GameState, action: GameAction): GameState {
  if (state.phase === 'game-over') illegal('The game is over.');
  if (action.seat !== actingSeat(state)) illegal("It isn't your turn.");
  const s = structuredClone(state);
  const prompt = s.prompts[0];

  if (prompt) {
    handlePrompt(s, prompt, action);
  } else if (action.type === 'play') {
    if (s.turnActionTaken) illegal('Your turn is over.');
    playCard(s, action.seat, action.cardId);
    s.turnActionTaken = true;
  } else if (action.type === 'pass') {
    if (s.turnActionTaken) illegal('Your turn is over.');
    const player = s.players[action.seat];
    log(s, player.down ? `${player.name} stays down.` : `${player.name} passes.`);
    player.down = true;
    s.turnActionTaken = true;
    const up = s.players.map((_, i) => i).filter((i) => !s.players[i].down);
    if (up.length === 1) {
      s.roundEnding = { starter: up[0] };
      log(s, `Everyone else is down. The round ends.`);
      if (s.lastNumberSeat !== null) s.prompts.unshift({ type: 'round-end-move', seat: s.lastNumberSeat });
    }
  } else {
    illegal('That action is not available right now.');
  }

  settle(s);
  return s;
}
