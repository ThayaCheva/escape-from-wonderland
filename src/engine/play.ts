import { CARD_DEFS, cardLabel, isNumber } from './cards';
import { checkPlay } from './rules';
import { log, nameOf, placeNumber, removeFromHand } from './mutate';
import { IllegalActionError } from './errors';
import { ACTION_EFFECTS } from './effects/actions';
import { EVENT_EFFECTS } from './effects/events';
import type { ActionName, EventName, GameState, Seat, SpecialCard } from './types';

/** Play a card from hand, including its whole effect (which may queue prompts). */
export function playCard(s: GameState, seat: Seat, cardId: string, opts: { free?: boolean } = {}): void {
  const check = checkPlay(s, seat, cardId, opts);
  if (!check.ok) throw new IllegalActionError(check.reason);
  const player = s.players[seat];
  const card = removeFromHand(s, seat, cardId);
  if (player.down) {
    player.down = false;
    log(s, `${player.name} rejoins.`);
  }
  if (isNumber(card)) {
    placeNumber(s, seat, card);
    return;
  }
  const def = CARD_DEFS[card.name];
  if (def.lasting) s.active.push({ card, seat });
  else s.discard.push(card);
  if (s.effectCauser === null) s.effectCauser = seat;
  log(s, `${nameOf(s, seat)} plays ${cardLabel(card)}.`);
  resolveSpecial(s, seat, card);
}

export function resolveSpecial(s: GameState, seat: Seat, card: SpecialCard): void {
  if (card.kind === 'action') ACTION_EFFECTS[card.name as ActionName](s, seat, card);
  else EVENT_EFFECTS[card.name as EventName](s, seat, card);
}
