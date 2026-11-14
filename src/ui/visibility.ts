// Decides which card faces may be shown on the shared screen. Every card face in the UI goes through here.
import { actingSeat } from '../engine/step';
import type { GameState, Prompt, Seat } from '../engine/types';

export interface UiGate {
  /** The seat that clicked the hand-off banner and now holds the mouse. */
  confirmedSeat: Seat | null;
  peeked: boolean;
}

export function needsHandoff(state: GameState, gate: UiGate): boolean {
  if (state.phase === 'game-over') return false;
  return actingSeat(state) !== gate.confirmedSeat;
}

export function confirm(state: GameState): UiGate {
  return { confirmedSeat: actingSeat(state), peeked: false };
}

const OWN_HAND_PROMPTS: ReadonlySet<Prompt['type']> = new Set([
  'setup-pick',
  'drink-me-extra',
  'eat-me',
  'execution-choose',
  'vines-give',
  'discard',
]);

export function promptNeedsOwnHand(p: Prompt | undefined): boolean {
  return p !== undefined && OWN_HAND_PROMPTS.has(p.type);
}

/** The one seat whose own hand may be face up right now, or null. */
export function faceUpHandSeat(state: GameState, gate: UiGate): Seat | null {
  if (needsHandoff(state, gate) || gate.confirmedSeat === null) return null;
  const front = state.prompts[0];
  if (front?.type === 'view-hand') return null;
  return gate.peeked || promptNeedsOwnHand(front) ? gate.confirmedSeat : null;
}

/** For a Caterpillar view, the seat whose hand the viewer may see. */
export function revealedOtherHand(state: GameState, gate: UiGate): Seat | null {
  const front = state.prompts[0];
  if (front?.type !== 'view-hand' || needsHandoff(state, gate)) return null;
  return front.target;
}
