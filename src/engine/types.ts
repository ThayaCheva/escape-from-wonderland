export type Seat = number;
export type Color = 'red' | 'white';
export type LocationId = 'white-queen' | 'mad-hatter' | 'black-forest' | 'chess' | 'red-queen';
export type Position = LocationId | 'outskirts';
export type Edge = 'bottom' | 'left' | 'top' | 'right';
export type AliceColor = 'gold' | 'rose' | 'blue' | 'mint';

export type ActionName =
  | 'drink-me'
  | 'eat-me'
  | 'vorpal-sword'
  | 'cheshire-cat'
  | 'execution-order'
  | 'dead-red-knight'
  | 'dead-white-knight'
  | 'caterpillar'
  | 'exile';

export type EventName =
  | 'wq-generosity'
  | 'tweedledee'
  | 'tweedledum'
  | 'jabberwocky'
  | 'mh-party'
  | 'tea-of-confusion'
  | 'rabbit-hole'
  | 'rq-decree'
  | 'shadow-creatures'
  | 'vines';

export type CardName = ActionName | EventName;

export interface NumberCard {
  id: string;
  kind: 'number';
  color: Color;
  value: number;
}

export interface SpecialCard {
  id: string;
  kind: 'action' | 'event';
  name: CardName;
}

export type Card = NumberCard | SpecialCard;

export interface CardDef {
  name: CardName;
  kind: 'action' | 'event';
  title: string;
  location: LocationId | null;
  lasting: boolean;
  text: string;
}

export interface PileEntry {
  card: NumberCard;
  seat: Seat;
  effective: number;
  modifier: -1 | 0 | 1;
}

export interface PlayedCard {
  card: Card;
  seat: Seat;
}

export interface ActiveEntry {
  card: SpecialCard;
  seat: Seat;
}

export interface Player {
  name: string;
  alice: AliceColor;
  edge: Edge;
  hand: Card[];
  position: Position;
  down: boolean;
  skipNextTurn: boolean;
  drinkMeLock: 'none' | 'pending' | 'active';
}

export type Prompt =
  | { type: 'setup-pick'; seat: Seat }
  | { type: 'drink-me-extra'; seat: Seat; remaining: number }
  | { type: 'eat-me'; seat: Seat }
  | { type: 'vorpal-target'; seat: Seat }
  | { type: 'execution-declare'; seat: Seat }
  | { type: 'execution-choose'; seat: Seat; value: number; bySeat: Seat }
  | { type: 'choose-player'; seat: Seat; purpose: 'caterpillar' | 'exile' | 'vines'; options: Seat[] }
  | { type: 'view-hand'; seat: Seat; target: Seat }
  | { type: 'exile-location'; seat: Seat; target: Seat }
  | { type: 'vines-take'; seat: Seat; target: Seat }
  | { type: 'vines-give'; seat: Seat; target: Seat; takenCardId: string }
  | { type: 'discard'; seat: Seat; min: number; max: number; drawAfter: number; reason: string }
  | { type: 'round-end-move'; seat: Seat };

export type GameAction =
  | { type: 'setup-pick'; seat: Seat; cardId: string | null }
  | { type: 'play'; seat: Seat; cardId: string }
  | { type: 'pass'; seat: Seat }
  | { type: 'choose-cards'; seat: Seat; cardIds: string[] }
  | { type: 'choose-seat'; seat: Seat; target: Seat }
  | { type: 'choose-location'; seat: Seat; location: LocationId | null }
  | { type: 'choose-value'; seat: Seat; value: number }
  | { type: 'choose-active'; seat: Seat; index: number }
  | { type: 'choose-hand-index'; seat: Seat; index: number }
  | { type: 'ack'; seat: Seat }
  | { type: 'done'; seat: Seat };

export interface GameState {
  version: 1;
  phase: 'setup' | 'playing' | 'game-over';
  players: Player[];
  deck: Card[];
  discard: Card[];
  pile: PileEntry[];
  active: ActiveEntry[];
  current: Seat;
  lastNumberSeat: Seat | null;
  /** The most recent public play, including lasting cards. Older saves can omit it. */
  lastPlayed?: PlayedCard;
  round: number;
  cheshireUsedThisRound: boolean;
  turnActionTaken: boolean;
  roundEnding: { starter: Seat } | null;
  /** Seat whose card started the current effect (win tie-break). */
  effectCauser: Seat | null;
  setupPicks: Record<number, string | null>;
  /** Front of the queue is prompts[0]. */
  prompts: Prompt[];
  winner: Seat | null;
  log: string[];
  seed: number;
}
