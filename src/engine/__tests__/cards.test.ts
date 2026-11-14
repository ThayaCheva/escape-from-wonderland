import { describe, expect, it } from 'vitest';
import { buildDeck, cardLabel, CARD_DEFS, isNumber } from '../cards';
import { num, sp } from '../testkit';

describe('cards', () => {
  it('builds the 142-card deck', () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(142);
    expect(deck.filter(isNumber)).toHaveLength(104);
    expect(deck.filter((c) => c.kind === 'action')).toHaveLength(18);
    expect(deck.filter((c) => c.kind === 'event')).toHaveLength(20);
    expect(new Set(deck.map((c) => c.id)).size).toBe(142);
    expect(deck.filter((c) => isNumber(c) && c.color === 'red' && c.value === 9)).toHaveLength(4);
  });

  it('labels cards', () => {
    expect(cardLabel(num('R', 9))).toBe('Red 9');
    expect(cardLabel(num('W', 13))).toBe('White 13');
    expect(cardLabel(sp('vines'))).toBe('Vines of the Black Forest');
  });

  it('ties events to locations', () => {
    expect(CARD_DEFS.jabberwocky.location).toBe('chess');
    expect(CARD_DEFS['drink-me'].location).toBeNull();
  });
});
