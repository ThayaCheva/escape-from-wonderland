// Test-only builders for hand-made game states. Not imported by game code.
import type {
  ActiveEntry,
  AliceColor,
  Card,
  CardName,
  Edge,
  GameState,
  NumberCard,
  PileEntry,
  Player,
  Seat,
  SpecialCard,
} from './types';
import { CARD_DEFS } from './cards';

let counter = 0;

export function num(color: 'R' | 'W', value: number): NumberCard {
  counter++;
  return { id: `t${color}${value}-${counter}`, kind: 'number', color: color === 'R' ? 'red' : 'white', value };
}

export function sp(name: CardName): SpecialCard {
  counter++;
  return { id: `t${name}-${counter}`, kind: CARD_DEFS[name].kind, name };
}

export function pileOf(card: NumberCard, seat: Seat = 0, modifier: -1 | 0 | 1 = 0): PileEntry {
  return { card, seat, modifier, effective: card.value + modifier };
}

const EDGES: Record<number, Edge[]> = { 2: ['bottom', 'top'], 3: ['bottom', 'left', 'right'], 4: ['bottom', 'left', 'top', 'right'] };
const ALICE: Record<Edge, AliceColor> = { bottom: 'gold', left: 'rose', top: 'blue', right: 'mint' };

export function makeState(opts: {
  players: Array<Partial<Player>>;
  pile?: PileEntry[];
  active?: ActiveEntry[];
  current?: Seat;
  deck?: Card[];
  discard?: Card[];
  lastNumberSeat?: Seat | null;
}): GameState {
  const edges = EDGES[opts.players.length] ?? EDGES[4];
  const players: Player[] = opts.players.map((p, i) => {
    const edge = edges[i] ?? 'bottom';
    return {
      name: `P${i}`,
      alice: ALICE[edge],
      edge,
      hand: [],
      position: 'outskirts',
      down: false,
      skipNextTurn: false,
      drinkMeLock: 'none',
      ...p,
    };
  });
  return {
    version: 1,
    phase: 'playing',
    players,
    deck: opts.deck ?? [],
    discard: opts.discard ?? [],
    pile: opts.pile ?? [],
    active: opts.active ?? [],
    current: opts.current ?? 0,
    lastNumberSeat: opts.lastNumberSeat ?? null,
    round: 1,
    cheshireUsedThisRound: false,
    turnActionTaken: false,
    roundEnding: null,
    effectCauser: null,
    setupPicks: {},
    prompts: [],
    winner: null,
    log: [],
    seed: 1,
  };
}
