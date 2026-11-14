// Test-only random legal player, shared by the fuzz test and probes.
import { actingSeat } from '../step';
import { checkPlay } from '../rules';
import { isNumber } from '../cards';
import { LOCATIONS } from '../board';
import { nextRandom } from '../rng';
import type { GameAction, GameState } from '../types';

export type Rand = () => number;

export function makeRand(seed: number): Rand {
  let s = seed;
  return () => {
    const [v, next] = nextRandom(s);
    s = next;
    return v;
  };
}

const pick = <T,>(rand: Rand, items: T[]): T => items[Math.floor(rand() * items.length)];

function randomSubset<T>(rand: Rand, items: T[], max: number): T[] {
  const shuffled = [...items].sort(() => rand() - 0.5);
  return shuffled.slice(0, Math.floor(rand() * (Math.min(max, items.length) + 1)));
}

export function totalCards(s: GameState): number {
  return (
    s.deck.length +
    s.discard.length +
    s.pile.length +
    s.active.length +
    s.players.reduce((t, p) => t + p.hand.length, 0)
  );
}

/** A random legal action for whoever must act, or null if none could be found. */
export function randomAction(s: GameState, rand: Rand): GameAction | null {
  const seat = actingSeat(s);
  const hand = s.players[seat].hand;
  const p = s.prompts[0];
  if (!p) {
    const playable = hand.filter((c) => checkPlay(s, seat, c.id).ok);
    if (playable.length > 0 && rand() < 0.85) return { type: 'play', seat, cardId: pick(rand, playable).id };
    return { type: 'pass', seat };
  }
  switch (p.type) {
    case 'setup-pick': {
      const nums = hand.filter(isNumber);
      return { type: 'setup-pick', seat, cardId: nums.length ? pick(rand, nums).id : null };
    }
    case 'drink-me-extra': {
      const playable = hand.filter((c) => checkPlay(s, seat, c.id, { free: true }).ok);
      if (playable.length > 0 && rand() < 0.7) return { type: 'play', seat, cardId: pick(rand, playable).id };
      return { type: 'done', seat };
    }
    case 'eat-me': {
      const small = hand.filter(isNumber).filter((c) => c.value <= 5);
      const chosen: string[] = [];
      let sum = 0;
      for (const c of small.sort(() => rand() - 0.5)) {
        if (sum + c.value <= 5 && rand() < 0.7) {
          chosen.push(c.id);
          sum += c.value;
        }
      }
      return { type: 'choose-cards', seat, cardIds: chosen };
    }
    case 'vorpal-target': {
      const idx = s.active.map((a, i) => (a.card.name === 'cheshire-cat' ? -1 : i)).filter((i) => i >= 0);
      return idx.length ? { type: 'choose-active', seat, index: pick(rand, idx) } : null;
    }
    case 'execution-declare':
      return { type: 'choose-value', seat, value: 1 + Math.floor(rand() * 13) };
    case 'execution-choose': {
      const m = hand.filter((c) => isNumber(c) && c.value === p.value);
      return m.length ? { type: 'choose-cards', seat, cardIds: [pick(rand, m).id] } : null;
    }
    case 'choose-player':
      return p.options.length ? { type: 'choose-seat', seat, target: pick(rand, p.options) } : null;
    case 'view-hand':
      return { type: 'ack', seat };
    case 'exile-location': {
      const opts = LOCATIONS.filter((l) => l !== s.players[p.target].position);
      return { type: 'choose-location', seat, location: pick(rand, [...opts]) };
    }
    case 'vines-take': {
      const n = s.players[p.target].hand.length;
      return n ? { type: 'choose-hand-index', seat, index: Math.floor(rand() * n) } : null;
    }
    case 'vines-give': {
      const opts = hand.filter((c) => c.id !== p.takenCardId);
      return opts.length ? { type: 'choose-cards', seat, cardIds: [pick(rand, opts).id] } : null;
    }
    case 'discard': {
      const min = Math.min(p.min, hand.length);
      let chosen = randomSubset(rand, hand, p.max);
      if (chosen.length < min) chosen = hand.slice(0, min);
      return { type: 'choose-cards', seat, cardIds: chosen.map((c) => c.id) };
    }
    case 'round-end-move':
      return { type: 'choose-location', seat, location: rand() < 0.2 ? null : pick(rand, [...LOCATIONS]) };
  }
}

