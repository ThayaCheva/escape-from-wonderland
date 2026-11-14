import { CARD_DEFS, isNumber } from './cards';
import { LOCATION_NAMES } from './board';
import type { Color, GameState, Seat } from './types';

export type EffectSource = { kind: 'action' | 'event'; bySeat: Seat };
export type PlayCheck = { ok: true } | { ok: false; reason: string };
export type ColorRule = { mode: 'any' } | { mode: 'must'; color: Color } | { mode: 'not'; color: Color };

const OK: PlayCheck = { ok: true };
const no = (reason: string): PlayCheck => ({ ok: false, reason });
const colorName = (c: Color) => (c === 'red' ? 'Red' : 'White');

export function hasCheshire(state: GameState, seat: Seat): boolean {
  return state.active.some((a) => a.card.name === 'cheshire-cat' && a.seat === seat);
}

export function locationEffectsOn(state: GameState, seat: Seat): boolean {
  const shadows = state.active.filter((a) => a.card.name === 'shadow-creatures');
  if (shadows.length === 0) return true;
  return hasCheshire(state, seat) && shadows.every((a) => a.seat !== seat);
}

export function modifierFor(state: GameState, seat: Seat): -1 | 0 | 1 {
  if (!locationEffectsOn(state, seat)) return 0;
  const pos = state.players[seat].position;
  if (pos === 'white-queen') return -1;
  if (pos === 'red-queen') return 1;
  return 0;
}

export function isImmune(state: GameState, seat: Seat, source: EffectSource): boolean {
  const chess =
    source.kind === 'event' && state.players[seat].position === 'chess' && locationEffectsOn(state, seat);
  const cat = hasCheshire(state, seat) && source.bySeat !== seat;
  return chess || cat;
}

export function colorRule(state: GameState, seat: Seat): ColorRule {
  const top = state.pile[state.pile.length - 1];
  if (!top) return { mode: 'any' };
  if (state.players[seat].position === 'mad-hatter' && locationEffectsOn(state, seat)) return { mode: 'any' };
  const knights = state.active.filter(
    (a) => a.card.name === 'dead-red-knight' || a.card.name === 'dead-white-knight',
  );
  const knight = knights[knights.length - 1];
  if (knight && !(knight.seat !== seat && hasCheshire(state, seat))) {
    return { mode: 'must', color: knight.card.name === 'dead-red-knight' ? 'red' : 'white' };
  }
  return { mode: 'not', color: top.card.color };
}

/** Other players who can be chosen by Caterpillar ('action') or Vines ('event'). */
export function playerTargets(state: GameState, seat: Seat, kind: 'action' | 'event'): Seat[] {
  return state.players
    .map((_, i) => i)
    .filter((i) => i !== seat && state.players[i].hand.length > 0 && !isImmune(state, i, { kind, bySeat: seat }));
}

export function checkPlay(state: GameState, seat: Seat, cardId: string, opts: { free?: boolean } = {}): PlayCheck {
  const player = state.players[seat];
  const card = player.hand.find((c) => c.id === cardId);
  if (!card) return no("That card isn't in your hand.");

  if (player.drinkMeLock === 'active' && !isNumber(card)) return no('Drink Me: only number cards this turn.');

  if (isNumber(card)) {
    if (opts.free) return OK;
    const top = state.pile[state.pile.length - 1];
    if (!top) return OK;
    const effective = card.value + modifierFor(state, seat);
    const rule = colorRule(state, seat);
    let needColor: Color | null = null;
    if (rule.mode === 'must' && card.color !== rule.color) needColor = rule.color;
    if (rule.mode === 'not' && card.color === rule.color) needColor = rule.color === 'red' ? 'white' : 'red';
    const valueBad = effective < top.effective;
    if (needColor && valueBad) return no(`Must be ${colorName(needColor)} and at least ${top.effective}.`);
    if (needColor) return no(`Must be ${colorName(needColor)}.`);
    if (valueBad) return no(`Must be at least ${top.effective}.`);
    return OK;
  }

  const def = CARD_DEFS[card.name];
  if (def.kind === 'action' && player.position === 'black-forest' && locationEffectsOn(state, seat)) {
    return no('No Action cards in the Black Forest.');
  }
  if (def.kind === 'event' && def.location && player.position !== def.location) {
    return no(`Only playable at ${LOCATION_NAMES[def.location]}.`);
  }
  if (card.name === 'cheshire-cat' && state.cheshireUsedThisRound) return no('Only one Cheshire Cat per round.');
  if (card.name === 'vorpal-sword' && !state.active.some((a) => a.card.name !== 'cheshire-cat')) {
    return no('Nothing to slay.');
  }
  if (card.name === 'caterpillar' && playerTargets(state, seat, 'action').length === 0) return no('No one to target.');
  if (card.name === 'vines') {
    if (playerTargets(state, seat, 'event').length === 0) return no('No one to target.');
    if (player.hand.length < 2) return no('You need a card to swap.');
  }
  if (card.name === 'drink-me' && opts.free) return no("Drink Me can't be played as an extra card.");
  return OK;
}

export function nextSeat(state: GameState, seat: Seat): Seat {
  return (seat + 1) % state.players.length;
}

export function nextUpSeat(state: GameState, seat: Seat): Seat | null {
  for (let i = 1; i < state.players.length; i++) {
    const s = (seat + i) % state.players.length;
    if (!state.players[s].down) return s;
  }
  return null;
}
