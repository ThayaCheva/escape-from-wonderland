import type { AliceColor, Card } from '../engine/types';

const base = `${import.meta.env.BASE_URL}assets/`;

export function cardImage(card: Card): string {
  if (card.kind === 'number') return `${base}cards/${card.color === 'red' ? 'R' : 'W'}${card.value}.jpg`;
  return `${base}cards/${card.name}.jpg`;
}

export const CARD_BACK = `${base}cards/back.jpg`;
export const BOARD_IMAGE = `${base}board.jpg`;
export const TITLE_IMAGE = `${base}title.jpg`;
export const BACKGROUND_IMAGE = `${base}background.jpg`;

export function aliceImage(color: AliceColor): string {
  return `${base}tokens/alice-${color}.png`;
}

export const MODIFIER_IMAGE: Record<-1 | 1, string> = {
  [-1]: `${base}tokens/minus1.png`,
  [1]: `${base}tokens/plus1.png`,
};
