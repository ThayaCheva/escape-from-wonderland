import type { Card as CardT } from '../../engine/types';
import { fanLayout } from '../layout';
import { Card, CARD_SIZES } from './Card';

interface Props {
  cards: CardT[];
  faceUp: boolean;
  length: number;
  selectedIds?: string[];
  isDimmed?: (card: CardT) => boolean;
  onCardClick?: (card: CardT, index: number) => void;
}

export function Hand({ cards, faceUp, length, selectedIds = [], isDimmed, onCardClick }: Props) {
  const { w } = CARD_SIZES.hand;
  const { step, total } = fanLayout(cards.length, length, w);
  return (
    <div className="hand" style={{ width: length }}>
      <div className="hand-inner" style={{ width: total }}>
        {cards.map((card, i) => (
          <Card
            key={card.id}
            card={card}
            faceUp={faceUp}
            size="hand"
            selected={selectedIds.includes(card.id)}
            dimmed={faceUp && isDimmed ? isDimmed(card) : false}
            onClick={onCardClick ? () => onCardClick(card, i) : undefined}
            style={{ left: i * step, zIndex: i }}
          />
        ))}
      </div>
    </div>
  );
}
