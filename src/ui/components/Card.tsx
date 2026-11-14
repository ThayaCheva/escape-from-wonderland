import type { Card as CardT } from '../../engine/types';
import { cardLabel } from '../../engine/cards';
import { CARD_BACK, MODIFIER_IMAGE, cardImage } from '../assets';

export type CardSize = 'mini' | 'hand' | 'pile' | 'preview';
export const CARD_SIZES: Record<CardSize, { w: number; h: number }> = {
  mini: { w: 50, h: 70 },
  hand: { w: 75, h: 105 },
  pile: { w: 80, h: 112 },
  preview: { w: 300, h: 420 },
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
}

export function Card({ card, faceUp, size, selected, dimmed, highlight, modifier, onClick, style, title }: Props) {
  const { w, h } = CARD_SIZES[size];
  const showFace = faceUp && card !== null;
  const classes = ['card', `card-${size}`];
  if (selected) classes.push('selected');
  if (dimmed) classes.push('dimmed');
  if (highlight) classes.push('highlight');
  if (onClick) classes.push('clickable');
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
