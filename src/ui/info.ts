// Pure helpers that turn game state into things shown on screen.
import { isNumber } from '../engine/cards';
import { LOCATION_NAMES } from '../engine/board';
import { checkPlay, locationEffectsOn, nextSeat } from '../engine/rules';
import type { GameAction, GameState, LocationId, Seat } from '../engine/types';

export function hasLegalPlay(state: GameState, seat: Seat): boolean {
  return state.players[seat].hand.some((c) => checkPlay(state, seat, c.id).ok);
}

export function activeEffectLines(state: GameState): Array<{ index: number; text: string; slayable: boolean }> {
  return state.active.map((a, index) => {
    const who = state.players[a.seat].name;
    let text: string;
    switch (a.card.name) {
      case 'dead-red-knight':
        text = `Numbers must be Red (Dead Red Knight, ${who})`;
        break;
      case 'dead-white-knight':
        text = `Numbers must be White (Dead White Knight, ${who})`;
        break;
      case 'jabberwocky':
        text = `Everyone draws 1 card each turn (Jabberwocky, ${who})`;
        break;
      case 'shadow-creatures':
        text = `Location effects are off (Shadow Creatures, ${who})`;
        break;
      case 'cheshire-cat':
        text = `${who} is immune to other players' cards (Cheshire Cat)`;
        break;
      case 'tweedledee':
        text = `Tweedledee is waiting for Tweedledum (${who})`;
        break;
      case 'tweedledum':
        text = `Tweedledum is waiting for Tweedledee (${who})`;
        break;
      default:
        text = `${a.card.name} (${who})`;
    }
    return { index, text, slayable: a.card.name !== 'cheshire-cat' };
  });
}

const LOCATION_EFFECT: Record<LocationId, string> = {
  'white-queen': 'your numbers count 1 less',
  'red-queen': 'your numbers count 1 more',
  'black-forest': 'no Action cards here',
  'mad-hatter': 'your numbers ignore colour',
  chess: "Events don't affect you",
};

export function locationLine(state: GameState, seat: Seat, withEffect: boolean): string {
  const pos = state.players[seat].position;
  if (pos === 'outskirts') return 'In the Outskirts';
  const where = `At ${LOCATION_NAMES[pos]}`;
  if (!withEffect) return where;
  return `${where} — ${locationEffectsOn(state, seat) ? LOCATION_EFFECT[pos] : 'location effects are off'}`;
}

export function lastPlayLine(log: string[]): string | null {
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].includes(' plays ')) return log[i].replace(' plays ', ' played ');
  }
  return null;
}

export function nextSeatToAct(state: GameState): Seat {
  return nextSeat(state, state.current);
}

/** What dropping a card from your hand onto the board should do. */
export function dropAction(state: GameState, seat: Seat, cardId: string): { action: GameAction } | { reason: string } {
  const prompt = state.prompts[0];
  if (prompt?.type === 'setup-pick' && prompt.seat === seat) {
    const card = state.players[seat].hand.find((c) => c.id === cardId);
    return card && isNumber(card)
      ? { action: { type: 'setup-pick', seat, cardId } }
      : { reason: 'Choose a number card.' };
  }
  const myTurn = !prompt && state.phase === 'playing' && state.current === seat && !state.turnActionTaken;
  const extra = prompt?.type === 'drink-me-extra' && prompt.seat === seat;
  if (!myTurn && !extra) return { reason: "You can't play a card right now." };
  const check = checkPlay(state, seat, cardId, { free: extra });
  return check.ok ? { action: { type: 'play', seat, cardId } } : { reason: check.reason };
}

/**
 * Whether Pass should ask "Pass anyway?". Only when the player can see their own hand
 * (online, or after peeking on one screen) — otherwise the question would tell the whole
 * table that a face-down hand holds a playable card.
 */
export function passNeedsConfirm(state: GameState, seat: Seat, view: { online: boolean; peeked: boolean }): boolean {
  return (view.online || view.peeked) && hasLegalPlay(state, seat);
}

/**
 * The new value if it changed since last time, else null. `previous === undefined` means
 * "the screen just opened": what is already there isn't news.
 */
export function changedSince<T>(previous: T | null | undefined, current: T | null): T | null {
  if (previous === undefined || current === null || current === previous) return null;
  return current;
}

/** It's this player's turn, nothing is waiting on them, and no card in their hand can be played. */
export function shouldAutoPass(state: GameState, seat: Seat): boolean {
  return (
    state.phase === 'playing' &&
    state.prompts.length === 0 &&
    state.current === seat &&
    !state.turnActionTaken &&
    !hasLegalPlay(state, seat)
  );
}
