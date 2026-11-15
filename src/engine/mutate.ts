// Mutators that change a draft GameState in place. step() clones state before calling these.
import { cardLabel } from './cards';
import { LOCATION_NAMES } from './board';
import { modifierFor } from './rules';
import { shuffle } from './rng';
import { IllegalActionError } from './errors';
import type { Card, GameState, NumberCard, Position, Seat } from './types';

/** The log is a short on-screen strip; keeping it bounded keeps every step's state copy cheap. */
export const LOG_LIMIT = 200;

export function log(s: GameState, msg: string): void {
  s.log.push(msg);
  if (s.log.length > LOG_LIMIT) s.log.splice(0, s.log.length - LOG_LIMIT);
}

export const nameOf = (s: GameState, seat: Seat) => s.players[seat].name;

export function drawCards(s: GameState, seat: Seat, n: number): number {
  let drawn = 0;
  for (let i = 0; i < n; i++) {
    if (s.deck.length === 0) {
      if (s.discard.length === 0) break;
      const [deck, seed] = shuffle(s.discard, s.seed);
      s.deck = deck;
      s.discard = [];
      s.seed = seed;
      log(s, 'The discard pile is shuffled into a new deck.');
    }
    s.players[seat].hand.push(s.deck.pop()!);
    drawn++;
  }
  return drawn;
}

/** Draw and log "X draws N cards." (no log when nothing could be drawn). */
export function drawAndLog(s: GameState, seat: Seat, n: number): void {
  const drawn = drawCards(s, seat, n);
  if (drawn > 0) log(s, `${nameOf(s, seat)} draws ${drawn} card${drawn === 1 ? '' : 's'}.`);
}

export function removeFromHand(s: GameState, seat: Seat, cardId: string): Card {
  const hand = s.players[seat].hand;
  const i = hand.findIndex((c) => c.id === cardId);
  if (i < 0) throw new IllegalActionError("That card isn't in your hand.");
  return hand.splice(i, 1)[0];
}

export function discardFromHand(s: GameState, seat: Seat, cardIds: string[]): void {
  const cards = cardIds.map((id) => removeFromHand(s, seat, id));
  s.discard.push(...cards);
  if (cards.length > 0) log(s, `${nameOf(s, seat)} discards ${cards.map(cardLabel).join(', ')}.`);
}

export function moveToken(s: GameState, seat: Seat, to: Position): void {
  const player = s.players[seat];
  const from = player.position;
  player.position = to;
  log(s, `${player.name} moves to ${LOCATION_NAMES[to]}.`);
  if (from === 'black-forest' && to !== 'black-forest') {
    const mine = s.active.filter((a) => a.seat === seat && a.card.name === 'shadow-creatures');
    if (mine.length > 0) {
      s.active = s.active.filter((a) => !mine.includes(a));
      s.discard.push(...mine.map((a) => a.card));
      log(s, `${player.name} left the Black Forest, so their Shadow Creatures are discarded.`);
    }
  }
}

const POSITION_TITLES: Record<string, string> = {
  'white-queen': "White Queen's Castle",
  'red-queen': "Red Queen's Castle",
};

export function placeNumber(s: GameState, seat: Seat, card: NumberCard): void {
  const modifier = modifierFor(s, seat);
  const effective = card.value + modifier;
  s.pile.push({ card, seat, modifier, effective });
  s.lastNumberSeat = seat;
  s.lastPlayed = { card, seat };
  const suffix =
    modifier === 0 ? '' : ` (${POSITION_TITLES[s.players[seat].position]}: counts as ${effective})`;
  log(s, `${nameOf(s, seat)} plays ${cardLabel(card)}${suffix}.`);
}
