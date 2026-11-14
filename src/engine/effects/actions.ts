import { cardLabel, isNumber } from '../cards';
import { IllegalActionError } from '../errors';
import { drawAndLog, discardFromHand, log, moveToken, nameOf, placeNumber, removeFromHand } from '../mutate';
import { playCard } from '../play';
import { isImmune, nextUpSeat, playerTargets } from '../rules';
import type { ActionName, GameAction, GameState, NumberCard, Prompt, Seat, SpecialCard } from '../types';
import type { PromptHandlers } from './handlers';

type Effect = (s: GameState, seat: Seat, card: SpecialCard) => void;

function illegal(msg: string): never {
  throw new IllegalActionError(msg);
}

function expect<T extends GameAction['type']>(action: GameAction, type: T, msg: string): Extract<GameAction, { type: T }> {
  if (action.type !== type) illegal(msg);
  return action as Extract<GameAction, { type: T }>;
}

function pushFront(s: GameState, ...prompts: Prompt[]): void {
  s.prompts.unshift(...prompts);
}

function forcedPlay(s: GameState, target: Seat, card: NumberCard, user: Seat): void {
  removeFromHand(s, target, card.id);
  log(s, `${nameOf(s, target)} holds a ${card.value} and must play it.`);
  placeNumber(s, target, card);
  s.players[target].skipNextTurn = true;
  drawAndLog(s, user, 5);
}

export const ACTION_EFFECTS: Record<ActionName, Effect> = {
  'drink-me': (s, seat) => {
    s.players[seat].drinkMeLock = 'pending';
    pushFront(s, { type: 'drink-me-extra', seat, remaining: 2 });
  },
  'eat-me': (s, seat) => pushFront(s, { type: 'eat-me', seat }),
  'vorpal-sword': (s, seat) => pushFront(s, { type: 'vorpal-target', seat }),
  'cheshire-cat': (s, seat) => {
    s.cheshireUsedThisRound = true;
    log(s, `${nameOf(s, seat)} is immune to other players' cards until the round ends.`);
  },
  'execution-order': (s, seat) => pushFront(s, { type: 'execution-declare', seat }),
  'dead-red-knight': (s, seat, card) => knight(s, seat, card),
  'dead-white-knight': (s, seat, card) => knight(s, seat, card),
  caterpillar: (s, seat) =>
    pushFront(s, { type: 'choose-player', seat, purpose: 'caterpillar', options: playerTargets(s, seat, 'action') }),
  exile: (s, seat) => {
    const options = s.players.map((_, i) => i).filter((i) => !isImmune(s, i, { kind: 'action', bySeat: seat }));
    pushFront(s, { type: 'choose-player', seat, purpose: 'exile', options });
  },
};

function knight(s: GameState, seat: Seat, card: SpecialCard): void {
  const older = s.active.filter(
    (a) => a.card.id !== card.id && (a.card.name === 'dead-red-knight' || a.card.name === 'dead-white-knight'),
  );
  s.active = s.active.filter((a) => !older.includes(a));
  s.discard.push(...older.map((a) => a.card));
  log(s, `Until the round ends, number cards must be ${card.name === 'dead-red-knight' ? 'Red' : 'White'}.`);
  drawAndLog(s, seat, 1);
}

export const ACTION_PROMPT_HANDLERS: PromptHandlers = {
  'drink-me-extra': (s, prompt, action) => {
    if (action.type === 'done') {
      s.prompts.shift();
      return;
    }
    const a = expect(action, 'play', 'Play an extra card or finish.');
    s.prompts.shift();
    const before = s.prompts.length;
    playCard(s, prompt.seat, a.cardId, { free: true });
    if (prompt.remaining > 1) {
      const created = s.prompts.length - before;
      s.prompts.splice(created, 0, { type: 'drink-me-extra', seat: prompt.seat, remaining: prompt.remaining - 1 });
    }
  },

  'eat-me': (s, prompt, action) => {
    const a = expect(action, 'choose-cards', 'Choose number cards to discard.');
    const hand = s.players[prompt.seat].hand;
    const cards = a.cardIds.map((id) => hand.find((c) => c.id === id));
    if (new Set(a.cardIds).size !== a.cardIds.length || cards.some((c) => !c || !isNumber(c))) {
      illegal('Choose number cards from your hand.');
    }
    const sum = (cards as NumberCard[]).reduce((t, c) => t + c.value, 0);
    if (sum > 5) illegal('Those add up to more than 5.');
    s.prompts.shift();
    discardFromHand(s, prompt.seat, a.cardIds);
  },

  'vorpal-target': (s, prompt, action) => {
    const a = expect(action, 'choose-active', 'Choose an active card to slay.');
    const entry = s.active[a.index];
    if (!entry || entry.card.name === 'cheshire-cat') illegal("That card can't be slain.");
    s.prompts.shift();
    s.active.splice(a.index, 1);
    s.discard.push(entry.card);
    log(s, `${nameOf(s, prompt.seat)} slays ${cardLabel(entry.card)}.`);
  },

  'execution-declare': (s, prompt, action) => {
    const a = expect(action, 'choose-value', 'Declare a number from 1 to 13.');
    if (!Number.isInteger(a.value) || a.value < 1 || a.value > 13) illegal('Declare a number from 1 to 13.');
    s.prompts.shift();
    const user = prompt.seat;
    log(s, `${nameOf(s, user)} declares ${a.value}.`);
    const target = nextUpSeat(s, user);
    if (target === null || isImmune(s, target, { kind: 'action', bySeat: user })) {
      log(s, 'Execution Order has no effect.');
      return;
    }
    const matches = s.players[target].hand.filter((c): c is NumberCard => isNumber(c) && c.value === a.value);
    if (matches.length === 0) {
      log(s, `${nameOf(s, target)} has no ${a.value}.`);
      drawAndLog(s, target, 5);
    } else if (matches.length === 1) {
      forcedPlay(s, target, matches[0], user);
    } else {
      pushFront(s, { type: 'execution-choose', seat: target, value: a.value, bySeat: user });
    }
  },

  'execution-choose': (s, prompt, action) => {
    const a = expect(action, 'choose-cards', 'Choose which card to play.');
    const card = s.players[prompt.seat].hand.find((c) => c.id === a.cardIds[0]);
    if (a.cardIds.length !== 1 || !card || !isNumber(card) || card.value !== prompt.value) {
      illegal(`Choose one of your ${prompt.value}s.`);
    }
    s.prompts.shift();
    forcedPlay(s, prompt.seat, card, prompt.bySeat);
  },

  'choose-player': (s, prompt, action) => {
    const a = expect(action, 'choose-seat', 'Choose a player.');
    if (!prompt.options.includes(a.target)) illegal("You can't choose that player.");
    s.prompts.shift();
    const user = prompt.seat;
    if (prompt.purpose === 'caterpillar') {
      log(s, `${nameOf(s, user)} and ${nameOf(s, a.target)} look at each other's hands.`);
      pushFront(s, { type: 'view-hand', seat: user, target: a.target }, { type: 'view-hand', seat: a.target, target: user });
    } else if (prompt.purpose === 'exile') {
      pushFront(s, { type: 'exile-location', seat: user, target: a.target });
    } else {
      log(s, `${nameOf(s, user)} reaches into ${nameOf(s, a.target)}'s hand.`);
      pushFront(s, { type: 'vines-take', seat: user, target: a.target });
    }
  },

  'view-hand': (s, _prompt, action) => {
    expect(action, 'ack', 'Click OK when done looking.');
    s.prompts.shift();
  },

  'exile-location': (s, prompt, action) => {
    const a = expect(action, 'choose-location', 'Choose a location.');
    if (a.location === null || a.location === s.players[prompt.target].position) {
      illegal('Choose a different location.');
    }
    s.prompts.shift();
    moveToken(s, prompt.target, a.location);
    drawAndLog(s, prompt.target, 1);
  },
};
