import { buildDeck, cardLabel, isNumber } from './cards';
import { nextRandom, shuffle } from './rng';
import { log, nameOf } from './mutate';
import type { AliceColor, Edge, GameState, NumberCard, Player, Seat } from './types';

const EDGES: Record<3 | 4, Edge[]> = { 3: ['bottom', 'left', 'right'], 4: ['bottom', 'left', 'top', 'right'] };
export const ALICE_FOR_EDGE: Record<Edge, AliceColor> = { bottom: 'gold', left: 'rose', top: 'blue', right: 'mint' };
const ALICE_NAMES: Record<AliceColor, string> = {
  gold: 'Gold Alice',
  rose: 'Rose Alice',
  blue: 'Blue Alice',
  mint: 'Mint Alice',
};

function deal(s: GameState): void {
  const [deck, seed] = shuffle(buildDeck(), s.seed);
  s.seed = seed;
  s.deck = deck;
  for (const p of s.players) p.hand = s.deck.splice(s.deck.length - 7, 7);
  s.setupPicks = {};
  s.prompts = s.players.map((_, seat) => ({ type: 'setup-pick' as const, seat }));
}

export function newGame(opts: { playerCount: 3 | 4; names?: string[]; seed: number }): GameState {
  const players: Player[] = EDGES[opts.playerCount].map((edge, i) => {
    const alice = ALICE_FOR_EDGE[edge];
    return {
      name: opts.names?.[i]?.trim() || ALICE_NAMES[alice],
      alice,
      edge,
      hand: [],
      position: 'outskirts',
      down: false,
      skipNextTurn: false,
      drinkMeLock: 'none',
    };
  });
  const s: GameState = {
    version: 1,
    phase: 'setup',
    players,
    deck: [],
    discard: [],
    pile: [],
    active: [],
    current: 0,
    lastNumberSeat: null,
    round: 0,
    cheshireUsedThisRound: false,
    turnActionTaken: false,
    roundEnding: null,
    effectCauser: null,
    setupPicks: {},
    prompts: [],
    winner: null,
    log: [],
    seed: opts.seed >>> 0,
  };
  deal(s);
  log(s, 'Each player secretly chooses a number card. Lowest goes first.');
  return s;
}

/** Called once every player has picked. Returns the seat that starts, or null after a redeal. */
export function resolveSetup(s: GameState): Seat | null {
  const picks: Array<{ seat: Seat; card: NumberCard; tiebreak: number }> = [];
  for (const [seatStr, cardId] of Object.entries(s.setupPicks)) {
    if (cardId === null) continue;
    const seat = Number(seatStr);
    const hand = s.players[seat].hand;
    const i = hand.findIndex((c) => c.id === cardId);
    const card = hand.splice(i, 1)[0] as NumberCard;
    const [r, seed] = nextRandom(s.seed);
    s.seed = seed;
    picks.push({ seat, card, tiebreak: r });
  }
  if (picks.length === 0) {
    for (const p of s.players) p.hand = [];
    log(s, 'Nobody had a number card, so the cards are redealt.');
    deal(s);
    return null;
  }
  const colorRank = (c: NumberCard) => (c.color === 'red' ? 0 : 1);
  picks.sort(
    (a, b) => a.card.value - b.card.value || colorRank(a.card) - colorRank(b.card) || a.tiebreak - b.tiebreak,
  );
  for (let i = 1; i < picks.length; i++) {
    const a = picks[i - 1];
    const b = picks[i];
    if (a.card.value === b.card.value && a.card.color === b.card.color) {
      log(s, `Tie between ${nameOf(s, a.seat)} and ${nameOf(s, b.seat)} broken at random.`);
    }
  }
  log(s, `Revealed: ${picks.map((p) => `${nameOf(s, p.seat)} ${cardLabel(p.card)}`).join(', ')}.`);
  s.pile = picks.map((p) => ({ card: p.card, seat: p.seat, modifier: 0, effective: p.card.value }));
  s.lastNumberSeat = picks[picks.length - 1].seat;
  s.phase = 'playing';
  s.round = 1;
  log(s, `${nameOf(s, picks[0].seat)} goes first.`);
  return picks[0].seat;
}

export function checkSetupPick(s: GameState, seat: Seat, cardId: string | null): string | null {
  const hand = s.players[seat].hand;
  if (cardId === null) return hand.some(isNumber) ? 'You must choose a number card.' : null;
  const card = hand.find((c) => c.id === cardId);
  if (!card) return "That card isn't in your hand.";
  if (!isNumber(card)) return 'Choose a number card.';
  return null;
}
