import type { Card as CardT } from '../../engine/types';
import { cardLabel } from '../../engine/cards';
import { CARD_BACK, MODIFIER_IMAGE, cardImage } from '../assets';

export type CardSize = 'mini' | 'hand' | 'hand-lg' | 'hand-phone' | 'pile' | 'preview' | 'preview-sm';
export const CARD_SIZES: Record<CardSize, { w: number; h: number }> = {
  mini: { w: 50, h: 70 },
  hand: { w: 75, h: 105 },
  'hand-lg': { w: 100, h: 140 },
  'hand-phone': { w: 66, h: 92 },
  pile: { w: 70, h: 98 },
  preview: { w: 300, h: 420 },
  'preview-sm': { w: 200, h: 280 },
};

interface Props {
  card: CardT | null;
  faceUp: boolean;
  size: CardSize;
  selected?: boolean;
  dimmed?: boolean;
  highlight?: boolean;
  modifier?: -1 | 0 | 1;
  onClick?: () => void;
  style?: React.CSSProperties;
  title?: string;
  className?: string;
}

export function Card({ card, faceUp, size, selected, dimmed, highlight, modifier, onClick, style, title, className }: Props) {
  const { w, h } = CARD_SIZES[size];
  // a hidden card (online: someone else's) can never be shown face up
  const showFace = faceUp && card !== null && (card as { kind: string }).kind !== 'hidden';
  const classes = ['card', `card-${size}`];
  if (selected) classes.push('selected');
  if (dimmed) classes.push('dimmed');
  if (highlight) classes.push('highlight');
  if (onClick) classes.push('clickable');
  if (className) classes.push(className);
  return (
    <div
      className={classes.join(' ')}
      style={{ width: w, height: h, ...style }}
      data-face={showFace ? 'up' : 'down'}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      title={title}
    >
      <img src={showFace ? cardImage(card) : CARD_BACK} alt={showFace ? cardLabel(card) : 'Card back'} draggable={false} />
      {showFace && modifier ? <img className="modifier-badge" src={MODIFIER_IMAGE[modifier]} alt={modifier > 0 ? '+1' : '-1'} /> : null}
    </div>
  );
}
