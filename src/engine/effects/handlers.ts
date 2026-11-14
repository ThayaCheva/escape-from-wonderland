import type { GameAction, GameState, Prompt } from '../types';

export type PromptHandlers = {
  [K in Prompt['type']]?: (s: GameState, prompt: Extract<Prompt, { type: K }>, action: GameAction) => void;
};
