import { useEffect, useId, useRef } from 'react';
import type { Card as CardT } from '../../engine/types';
import { cardLabel, CARD_DEFS, isNumber } from '../../engine/cards';
import { LOCATION_NAMES } from '../../engine/board';
import { Card } from './Card';
import { useScreen } from '../screen';

interface Props {
  card: CardT;
  rotation: number;
  playedBy?: string;
  returnFocus?: HTMLElement;
  action?: { label: string; reason: string | null; run: () => void };
  onCancel: () => void;
}

export function CardPreview({ card, rotation, playedBy, returnFocus, action, onCancel }: Props) {
  const def = isNumber(card) ? null : CARD_DEFS[card.name];
  const titleId = useId();
  const back = useRef<HTMLButtonElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = returnFocus ?? document.activeElement;
    back.current?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [returnFocus]);

  return (
    <div className={`overlay${playedBy !== undefined ? ' played-card-overlay' : ''}`} onClick={onCancel}>
      <div
        className="preview"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onCancel();
          } else if (e.key === 'Tab') {
            e.preventDefault();
            if (e.target === back.current && primary.current && !primary.current.disabled) primary.current.focus();
            else back.current?.focus();
          }
        }}
      >
        <Card card={card} faceUp size={useScreen() === 'phone' ? 'preview-sm' : 'preview'} />
        <div className="preview-side">
          {playedBy !== undefined ? <p className="preview-attribution">Played by {playedBy}</p> : null}
          <h2 id={titleId}>{cardLabel(card)}</h2>
          {def ? (
            <p className="preview-kind">
              {def.kind === 'action' ? 'Action' : `Event — ${def.location ? LOCATION_NAMES[def.location] : ''}`}
            </p>
          ) : null}
          {def && (playedBy !== undefined || def.name === 'execution-order') ? <p className="preview-rules">{def.text}</p> : null}
          {action?.reason ? <p className="preview-reason">{action.reason}</p> : null}
          <div className="row">
            <button className="btn" ref={back} onClick={onCancel}>
              Back
            </button>
            {action ? (
              <button className="btn big primary" ref={primary} disabled={action.reason !== null} onClick={action.run}>
                {action.label}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
