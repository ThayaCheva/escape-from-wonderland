import type { Card as CardT } from '../../engine/types';
import { fanLayout } from '../layout';
import { Card, CARD_SIZES } from './Card';

interface Props {
  cards: CardT[];
  faceUp: boolean;
  length: number;
  size?: 'hand' | 'hand-lg' | 'hand-phone';
  selectedIds?: string[];
  isDimmed?: (card: CardT) => boolean;
  onCardClick?: (card: CardT, index: number) => void;
  /** Pointer pressed on a face-up card (the table decides whether it becomes a drag). */
  onCardPointerDown?: (card: CardT, e: React.PointerEvent) => void;
  /** Pointer entered (card) or left (null) a face-up card. */
  onCardHover?: (card: CardT | null) => void;
}

export function Hand({ cards, faceUp, length, size = 'hand', selectedIds = [], isDimmed, onCardClick, onCardPointerDown, onCardHover }: Props) {
  const { w, h } = CARD_SIZES[size];
  const { step, total } = fanLayout(cards.length, length, w);
  return (
    <div className="hand" style={{ width: length, height: h + 15 }}>
      <div className="hand-inner" style={{ width: total, height: h }}>
        {cards.map((card, i) => (
          <div
            key={card.id}
            className="hand-slot"
            style={{ left: i * step, zIndex: i }}
            onPointerDown={faceUp && onCardPointerDown ? (e) => onCardPointerDown(card, e) : undefined}
            onPointerEnter={faceUp && onCardHover ? () => onCardHover(card) : undefined}
            onPointerLeave={faceUp && onCardHover ? () => onCardHover(null) : undefined}
          >
            <Card
              card={card}
              faceUp={faceUp}
              size={size}
              selected={selectedIds.includes(card.id)}
              dimmed={faceUp && isDimmed ? isDimmed(card) : false}
              onClick={onCardClick ? () => onCardClick(card, i) : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
