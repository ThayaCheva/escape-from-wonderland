// Works out which animations to play by comparing the previous and the new game state.
// Pure: no React, no DOM. Uses only information the viewer already has (public log + public state).
import { CARD_DEFS } from '../engine/cards';
import { LOCATION_NAMES } from '../engine/board';
import type { CardName, GameState, LocationId, Seat } from '../engine/types';

export type Anim =
  | { kind: 'special'; seat: Seat; name: CardName }
  | { kind: 'draw'; seat: Seat; count: number }
  | { kind: 'discard'; seat: Seat; count: number }
  | { kind: 'party' }
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
  if (prev.length === 0) return [...next];
  // find where prev's tail sits inside next, checking a few lines so repeated lines don't fool us
  const k = Math.min(3, prev.length);
  const tail = prev.slice(-k);
  for (let end = next.length; end >= k; end--) {
    if (tail.every((line, i) => next[end - k + i] === line)) return next.slice(end);
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
  for (const line of newLogLines(prev.log, next.log)) {
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(.+) plays (.+)\.$/))) {
      const name = TITLE_TO_NAME.get(m[2]);
      const seat = seatOf(m[1]);
      if (name && seat !== null) anims.push({ kind: 'special', seat, name });
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
      anims.push({ kind: 'party' });
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
