import type { EventName, GameState, Seat, SpecialCard } from '../types';
import type { PromptHandlers } from './handlers';

type Effect = (s: GameState, seat: Seat, card: SpecialCard) => void;
const none: Effect = () => {};

export const EVENT_EFFECTS: Record<EventName, Effect> = {
  'wq-generosity': none,
  tweedledee: none,
  tweedledum: none,
  jabberwocky: none,
  'mh-party': none,
  'tea-of-confusion': none,
  'rabbit-hole': none,
  'rq-decree': none,
  'shadow-creatures': none,
  vines: none,
};

export const EVENT_PROMPT_HANDLERS: PromptHandlers = {};
