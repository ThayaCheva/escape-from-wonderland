import { nextLocationClockwise } from '../board';
import { IllegalActionError } from '../errors';
import { drawAndLog, discardFromHand, log, moveToken, nameOf, removeFromHand } from '../mutate';
import { isImmune, playerTargets } from '../rules';
import type { EventName, GameState, Seat, SpecialCard } from '../types';
import type { PromptHandlers } from './handlers';

type Effect = (s: GameState, seat: Seat, card: SpecialCard) => void;

function illegal(msg: string): never {
  throw new IllegalActionError(msg);
}

/** Non-immune seats in clockwise order starting with the user. */
function participants(s: GameState, user: Seat): Seat[] {
  const n = s.players.length;
  return Array.from({ length: n }, (_, i) => (user + i) % n).filter(
    (seat) => !isImmune(s, seat, { kind: 'event', bySeat: user }),
  );
}

function tweedle(s: GameState, seat: Seat, card: SpecialCard): void {
  const partnerName = card.name === 'tweedledee' ? 'tweedledum' : 'tweedledee';
  const partner = s.active.find((a) => a.card.name === partnerName);
  if (!partner) {
    log(s, `${card.name === 'tweedledee' ? 'Tweedledee' : 'Tweedledum'} waits for a partner.`);
    return;
  }
  const self = s.active.find((a) => a.card.id === card.id)!;
  s.active = s.active.filter((a) => a !== partner && a !== self);
  s.discard.push(partner.card, card);
  log(s, 'Tweedledee and Tweedledum are together!');
  const reason = 'Tweedledee and Tweedledum: discard cards if you like.';
  if (partner.seat === seat) {
    s.prompts.unshift({ type: 'discard', seat, min: 0, max: 4, drawAfter: 0, reason });
  } else {
    s.prompts.unshift(
      { type: 'discard', seat, min: 0, max: 2, drawAfter: 0, reason },
      { type: 'discard', seat: partner.seat, min: 0, max: 2, drawAfter: 0, reason },
    );
  }
}

export const EVENT_EFFECTS: Record<EventName, Effect> = {
  'wq-generosity': (s, seat) => {
    const prompts = participants(s, seat)
      .filter((p) => s.players[p].hand.length > 0)
      .map((p) => ({
        type: 'discard' as const,
        seat: p,
        min: 1,
        max: 1,
        drawAfter: 0,
        reason: "White Queen's Generosity: discard 1 card.",
      }));
    s.prompts.unshift(...prompts);
  },
  tweedledee: tweedle,
  tweedledum: tweedle,
  jabberwocky: (s) => log(s, 'The Jabberwocky appears! Everyone draws a card every turn until it is slain.'),
  'mh-party': (s, seat) => {
    const p = participants(s, seat);
    const old = p.map((x) => s.players[x].hand);
    p.forEach((x, i) => {
      s.players[p[(i - 1 + p.length) % p.length]].hand = old[i];
    });
    log(s, 'Hands pass to the right.');
  },
  'tea-of-confusion': (s, seat) => {
    s.prompts.unshift(
      ...participants(s, seat).map((p) => ({
        type: 'discard' as const,
        seat: p,
        min: 0,
        max: 2,
        drawAfter: 2,
        reason: 'Tea of Confusion: discard up to 2 cards, then draw 2.',
      })),
    );
  },
  'rabbit-hole': (s, seat) => {
    for (const p of participants(s, seat)) {
      const pos = s.players[p].position;
      if (pos !== 'outskirts') moveToken(s, p, nextLocationClockwise(pos));
    }
  },
  'rq-decree': (s, seat) => {
    for (const p of participants(s, seat)) drawAndLog(s, p, 1);
  },
  'shadow-creatures': (s) => log(s, 'Shadow Creatures: location effects are switched off until the round ends.'),
  vines: (s, seat) => {
    s.prompts.unshift({ type: 'choose-player', seat, purpose: 'vines', options: playerTargets(s, seat, 'event') });
  },
};

export const EVENT_PROMPT_HANDLERS: PromptHandlers = {
  discard: (s, prompt, action) => {
    if (action.type !== 'choose-cards') illegal('Choose cards to discard.');
    const hand = s.players[prompt.seat].hand;
    const ids = action.cardIds;
    const min = Math.min(prompt.min, hand.length);
    if (new Set(ids).size !== ids.length || ids.some((id) => !hand.some((c) => c.id === id))) {
      illegal('Choose cards from your hand.');
    }
    if (ids.length < min || ids.length > prompt.max) {
      illegal(min === prompt.max ? `Choose exactly ${min}.` : `Choose up to ${prompt.max}.`);
    }
    s.prompts.shift();
    discardFromHand(s, prompt.seat, ids);
    if (prompt.drawAfter > 0) drawAndLog(s, prompt.seat, prompt.drawAfter);
  },

  'vines-take': (s, prompt, action) => {
    if (action.type !== 'choose-hand-index') illegal("Choose one of their cards.");
    const targetHand = s.players[prompt.target].hand;
    if (!Number.isInteger(action.index) || action.index < 0 || action.index >= targetHand.length) {
      illegal('Choose one of their cards.');
    }
    s.prompts.shift();
    const card = targetHand.splice(action.index, 1)[0];
    s.players[prompt.seat].hand.push(card);
    s.prompts.unshift({ type: 'vines-give', seat: prompt.seat, target: prompt.target, takenCardId: card.id });
  },

  'vines-give': (s, prompt, action) => {
    if (action.type !== 'choose-cards') illegal('Choose a card to give.');
    const id = action.cardIds[0];
    if (action.cardIds.length !== 1 || id === prompt.takenCardId || !s.players[prompt.seat].hand.some((c) => c.id === id)) {
      illegal('Choose a different card from your hand to give.');
    }
    s.prompts.shift();
    const card = removeFromHand(s, prompt.seat, id);
    s.players[prompt.target].hand.push(card);
    log(s, `${nameOf(s, prompt.seat)} and ${nameOf(s, prompt.target)} swap a card.`);
  },
};
