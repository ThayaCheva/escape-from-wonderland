// Per-seat redacted copies of the game state, safe to send to one player's browser.
import type { Card, GameState, Seat } from './types';

/** A face-down card whose identity the viewer may not know. Its id carries no information. */
export interface HiddenCard {
  id: string;
  kind: 'hidden';
}

export function isHidden(card: { kind: string }): boolean {
  return card.kind === 'hidden';
}

const hidden = (id: string) => ({ id, kind: 'hidden' }) as HiddenCard as unknown as Card;

export function viewFor(state: GameState, seat: Seat): GameState {
  const v = structuredClone(state);
  const front = v.prompts[0];
  const caterpillarTarget = front?.type === 'view-hand' && front.seat === seat ? front.target : null;

  v.players.forEach((p, owner) => {
    if (owner === seat || owner === caterpillarTarget) return;
    p.hand = p.hand.map((_, i) => hidden(`hidden-${owner}-${i}`));
  });
  v.deck = v.deck.map((_, i) => hidden(`hidden-deck-${i}`));
  v.seed = 0;
  if (v.phase === 'setup') {
    v.setupPicks = seat in v.setupPicks ? { [seat]: v.setupPicks[seat] } : {};
  }
  v.prompts = v.prompts.map((p) => (p.type === 'vines-give' && p.seat !== seat ? { ...p, takenCardId: '' } : p));
  return v;
}
