import type { Card as CardT } from '../../engine/types';
import { cardLabel, CARD_DEFS, isNumber } from '../../engine/cards';
import { LOCATION_NAMES } from '../../engine/board';
import { Card } from './Card';
import { useScreen } from '../screen';

interface Props {
  card: CardT;
  rotation: number;
  actionLabel: string;
  reason: string | null;
  onAction: () => void;
  onCancel: () => void;
}

export function CardPreview({ card, rotation, actionLabel, reason, onAction, onCancel }: Props) {
  const def = isNumber(card) ? null : CARD_DEFS[card.name];
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="preview" style={{ transform: `translate(-50%, -50%) rotate(${rotation}deg)` }} onClick={(e) => e.stopPropagation()}>
        <Card card={card} faceUp size={useScreen() === 'phone' ? 'preview-sm' : 'preview'} />
        <div className="preview-side">
          <h2>{cardLabel(card)}</h2>
          {def ? (
            <p className="preview-kind">
              {def.kind === 'action' ? 'Action' : `Event — ${def.location ? LOCATION_NAMES[def.location] : ''}`}
            </p>
          ) : null}
          {reason ? <p className="preview-reason">{reason}</p> : null}
          <div className="row">
            <button className="btn" onClick={onCancel}>
              Back
            </button>
            <button className="btn big" disabled={reason !== null} onClick={onAction}>
              {actionLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
