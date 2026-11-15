import type { Card, CardDef, CardName, NumberCard } from './types';

/** How many copies of each card are in the deck. Change these to change the deck. */
export const DECK_COMPOSITION = { numberCopies: 4, specialCopies: 2 } as const;

const def = (d: CardDef): CardDef => d;

export const CARD_DEFS: Record<CardName, CardDef> = {
  'drink-me': def({
    name: 'drink-me', kind: 'action', title: 'Drink Me Potion', location: null, lasting: false,
    text: 'PLAY any 2 additional cards. Next turn cannot play action card or event card.',
  }),
  'eat-me': def({
    name: 'eat-me', kind: 'action', title: 'Eat Me Cake', location: null, lasting: false,
    text: 'DISCARD any number cards that add up to 5 or less.',
  }),
  'vorpal-sword': def({
    name: 'vorpal-sword', kind: 'action', title: 'Vorpal Sword', location: null, lasting: false,
    text: 'Slays 1 active card on the field (e.g. Jabberwocky, Shadow Creatures, Dead Knights). Once used, place VORPAL SWORD and SLAIN CARD in the discard pile.',
  }),
  'cheshire-cat': def({
    name: 'cheshire-cat', kind: 'action', title: 'Cheshire Cat', location: null, lasting: true,
    text: "Immune to all effects of other player's cards. Effect lasts for the whole round. Only one CHESHIRE CAT can be active in a round.",
  }),
  'execution-order': def({
    name: 'execution-order', kind: 'action', title: 'Execution Order', location: null, lasting: false,
    text: 'Declare a number from 1 to 13. The next player who is up may play a matching card of either colour. If they play it, they skip their next turn and you draw 5 cards. If they decline or have no match, they draw 5 cards.',
  }),
  'dead-red-knight': def({
    name: 'dead-red-knight', kind: 'action', title: 'Dead Red Knight', location: null, lasting: true,
    text: 'Until the round ends, all subsequent cards must be RED. User draws 1 card.',
  }),
  'dead-white-knight': def({
    name: 'dead-white-knight', kind: 'action', title: 'Dead White Knight', location: null, lasting: true,
    text: 'Until the round ends, all subsequent cards must be WHITE. User draws 1 card.',
  }),
  caterpillar: def({
    name: 'caterpillar', kind: 'action', title: 'Wisdom of Caterpillar', location: null, lasting: false,
    text: 'Select a player and view their hand. Selected player can view your hand.',
  }),
  exile: def({
    name: 'exile', kind: 'action', title: 'Exile', location: null, lasting: false,
    text: 'Choose a player (including yourself) and move them to another location. Player who is moved must draw 1 card.',
  }),
  'wq-generosity': def({
    name: 'wq-generosity', kind: 'event', title: "White Queen's Generosity", location: 'white-queen', lasting: false,
    text: 'Every player discard 1 card.',
  }),
  tweedledee: def({
    name: 'tweedledee', kind: 'event', title: 'Tweedledee', location: 'white-queen', lasting: true,
    text: 'Must be played with a TWEEDLEDUM card. Once both cards are played, both USERS may DISCARD 2 additional cards. Both TWEEDLEDEE and TWEEDLEDUM must be played in the same round.',
  }),
  tweedledum: def({
    name: 'tweedledum', kind: 'event', title: 'Tweedledum', location: 'white-queen', lasting: true,
    text: 'Must be played with a TWEEDLEDEE card. Once both cards are played, both USERS may DISCARD 2 additional cards. Both TWEEDLEDEE and TWEEDLEDUM must be played in the same round.',
  }),
  jabberwocky: def({
    name: 'jabberwocky', kind: 'event', title: 'Jabberwocky', location: 'chess', lasting: true,
    text: 'Until Slain or the round ends, every player must draw 1 card every turn. Can be slayed by VORPAL SWORD.',
  }),
  'mh-party': def({
    name: 'mh-party', kind: 'event', title: "Mad Hatter's Party", location: 'mad-hatter', lasting: false,
    text: 'Every player passes their hand to the player to their immediate right.',
  }),
  'tea-of-confusion': def({
    name: 'tea-of-confusion', kind: 'event', title: 'Tea of Confusion', location: 'mad-hatter', lasting: false,
    text: 'Every player discard at most 2 cards from their hand and must draw 2 cards from the deck.',
  }),
  'rabbit-hole': def({
    name: 'rabbit-hole', kind: 'event', title: 'Rabbit Hole', location: 'red-queen', lasting: false,
    text: 'All player must move in the clockwise direction of their current location. No effect if the player is not in a location.',
  }),
  'rq-decree': def({
    name: 'rq-decree', kind: 'event', title: "Red Queen's Decree", location: 'red-queen', lasting: false,
    text: 'Every player draws 1 card.',
  }),
  'shadow-creatures': def({
    name: 'shadow-creatures', kind: 'event', title: 'Shadow Creatures', location: 'black-forest', lasting: true,
    text: 'For a single round, nullifies the effect of all board location. If user leaves BLACK FOREST when the card is still active, immediately put in discard pile.',
  }),
  vines: def({
    name: 'vines', kind: 'event', title: 'Vines of the Black Forest', location: 'black-forest', lasting: false,
    text: 'Select a card from another player and swap it with a card from your hand.',
  }),
};

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const color of ['red', 'white'] as const) {
    for (let value = 1; value <= 13; value++) {
      for (let copy = 1; copy <= DECK_COMPOSITION.numberCopies; copy++) {
        deck.push({ id: `${color === 'red' ? 'R' : 'W'}${value}-${copy}`, kind: 'number', color, value });
      }
    }
  }
  for (const d of Object.values(CARD_DEFS)) {
    for (let copy = 1; copy <= DECK_COMPOSITION.specialCopies; copy++) {
      deck.push({ id: `${d.name}-${copy}`, kind: d.kind, name: d.name });
    }
  }
  return deck;
}

export function isNumber(card: Card): card is NumberCard {
  return card.kind === 'number';
}

export function cardLabel(card: Card): string {
  if (isNumber(card)) return `${card.color === 'red' ? 'Red' : 'White'} ${card.value}`;
  return CARD_DEFS[card.name].title;
}
