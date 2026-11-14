// Works out which animations to play by comparing the previous and the new game state.
// Pure: no React, no DOM. Uses only information the viewer already has (public log + public state).
import { CARD_DEFS } from '../engine/cards';
import { LOCATION_NAMES } from '../engine/board';
import { isImmune } from '../engine/rules';
import type { CardName, GameState, LocationId, Seat } from '../engine/types';

export type Anim =
  | { kind: 'special'; seat: Seat; name: CardName }
  | { kind: 'draw'; seat: Seat; count: number }
  | { kind: 'discard'; seat: Seat; count: number }
  | { kind: 'party'; seats: Seat[] }
  | { kind: 'swap'; a: Seat; b: Seat }
  | { kind: 'peek'; a: Seat; b: Seat }
  | { kind: 'slay'; title: string }
  | { kind: 'down'; seat: Seat }
  | { kind: 'reveal' }
  | { kind: 'sweep' }
  | { kind: 'round'; round: number; starter: Seat }
  | { kind: 'turn'; seat: Seat }
  | { kind: 'win'; seat: Seat };

/** Lines added to the log since `prev`. Copes with the 200-line cap dropping old lines. */
export function newLogLines(prev: string[] | null, next: string[]): string[] {
  if (!prev) return [];
  // the log only grows at the end and loses lines at the front (200-line cap): find the
  // fewest dropped lines d such that what is left of prev is exactly how next begins
  for (let d = 0; d <= prev.length; d++) {
    const kept = prev.length - d;
    if (kept > next.length) continue;
    let match = true;
    for (let i = 0; i < kept; i++) {
      if (prev[d + i] !== next[i]) {
        match = false;
        break;
      }
    }
    if (match) return next.slice(kept);
  }
  return [];
}

const TITLE_TO_NAME = new Map(Object.values(CARD_DEFS).map((d) => [d.title, d.name] as const));

export function detectAnimations(prev: GameState | null, next: GameState): Anim[] {
  if (!prev) return [];
  const seatOf = (name: string) => {
    const i = next.players.findIndex((p) => p.name === name);
    return i < 0 ? null : i;
  };
  const anims: Anim[] = [];
  let partyBy: Seat | null = null;
  for (const line of newLogLines(prev.log, next.log)) {
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(.+) plays (.+)\.$/))) {
      const name = TITLE_TO_NAME.get(m[2]);
      const seat = seatOf(m[1]);
      if (name && seat !== null) anims.push({ kind: 'special', seat, name });
      if (name === 'mh-party') partyBy = seat;
    } else if ((m = line.match(/^(.+) draws (\d+) cards?\.$/))) {
      const seat = seatOf(m[1]);
      if (seat !== null) anims.push({ kind: 'draw', seat, count: Number(m[2]) });
    } else if ((m = line.match(/^The Jabberwocky makes (.+) draw a card\.$/))) {
      const seat = seatOf(m[1]);
      if (seat !== null) anims.push({ kind: 'draw', seat, count: 1 });
    } else if ((m = line.match(/^(.+) discards (.+)\.$/))) {
      const seat = seatOf(m[1]);
      if (seat !== null) anims.push({ kind: 'discard', seat, count: m[2].split(', ').length });
    } else if (line === 'Hands pass to the right.') {
      // only players who weren't immune passed their hands
      const all = prev.players.map((_, i) => i);
      const by = partyBy;
      anims.push({ kind: 'party', seats: by === null ? all : all.filter((i) => !isImmune(prev, i, { kind: 'event', bySeat: by })) });
    } else if ((m = line.match(/^(.+) and (.+) swap a card\.$/))) {
      const a = seatOf(m[1]);
      const b = seatOf(m[2]);
      if (a !== null && b !== null) anims.push({ kind: 'swap', a, b });
    } else if ((m = line.match(/^(.+) and (.+) look at each other's hands\.$/))) {
      const a = seatOf(m[1]);
      const b = seatOf(m[2]);
      if (a !== null && b !== null) anims.push({ kind: 'peek', a, b });
    } else if ((m = line.match(/^(.+) slays (.+)\.$/))) {
      anims.push({ kind: 'slay', title: m[2] });
    } else if ((m = line.match(/^(.+) passes\.$/))) {
      const seat = seatOf(m[1]);
      if (seat !== null) anims.push({ kind: 'down', seat });
    }
  }

  if (next.phase === 'game-over') {
    if (prev.phase !== 'game-over' && next.winner !== null) anims.push({ kind: 'win', seat: next.winner });
    return anims;
  }
  if (prev.phase === 'setup' && next.phase === 'playing') anims.push({ kind: 'reveal' });
  const newRound = next.round > prev.round && next.phase === 'playing';
  if (newRound && prev.pile.length > 0 && prev.phase === 'playing') anims.push({ kind: 'sweep' });
  if (newRound) anims.push({ kind: 'round', round: next.round, starter: next.current });
  if (next.phase === 'playing' && (prev.current !== next.current || newRound || prev.phase !== 'playing')) {
    anims.push({ kind: 'turn', seat: next.current });
  }
  return anims;
}

/** Players who have already chosen their starting card (setup only). */
export function pickedSeats(state: GameState): Seat[] {
  if (state.phase !== 'setup') return [];
  const waiting = new Set(state.prompts.filter((p) => p.type === 'setup-pick').map((p) => p.seat));
  return state.players.map((_, i) => i).filter((i) => !waiting.has(i));
}

const EFFECT: Record<LocationId, string> = {
  'white-queen': 'Number cards you play count 1 less.',
  'red-queen': 'Number cards you play count 1 more.',
  'black-forest': "You can't play Action cards here.",
  'mad-hatter': 'Number cards you play ignore the colour rule.',
  chess: "Event cards don't affect you here.",
};

export function locationInfo(state: GameState, loc: LocationId): { name: string; effect: string; events: string[]; off: boolean } {
  const events = [...new Set(Object.values(CARD_DEFS).filter((d) => d.location === loc).map((d) => d.title))];
  return {
    name: LOCATION_NAMES[loc].replace(/^the /, ''),
    effect: EFFECT[loc],
    events,
    off: state.active.some((a) => a.card.name === 'shadow-creatures'),
  };
}

/** A queued turn banner is out of date once the turn has moved on (or the game ended). */
export function isStale(anim: Anim, state: GameState): boolean {
  if (anim.kind !== 'turn') return false;
  return state.phase !== 'playing' || state.current !== anim.seat;
}
