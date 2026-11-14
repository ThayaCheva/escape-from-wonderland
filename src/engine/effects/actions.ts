import type { ActionName, GameState, Seat, SpecialCard } from '../types';
import type { PromptHandlers } from './handlers';

type Effect = (s: GameState, seat: Seat, card: SpecialCard) => void;
const none: Effect = () => {};

export const ACTION_EFFECTS: Record<ActionName, Effect> = {
  'drink-me': none,
  'eat-me': none,
  'vorpal-sword': none,
  'cheshire-cat': none,
  'execution-order': none,
  'dead-red-knight': none,
  'dead-white-knight': none,
  caterpillar: none,
  exile: none,
};

export const ACTION_PROMPT_HANDLERS: PromptHandlers = {};
