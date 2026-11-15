import { useEffect, useId, useRef, useState } from 'react';
import { cardLabel, CARD_DEFS, isNumber } from '../../engine/cards';
import type { Player } from '../../engine/types';
import { useScreen } from '../screen';
import { Card } from './Card';

export function RevealedHand({ player, rotation, onDone }: {
  player: Player;
  rotation: number;
  onDone: () => void;
}) {
  const titleId = useId();
  const grid = useRef<HTMLDivElement>(null);
  const done = useRef<HTMLButtonElement>(null);
  const [selectedId, setSelectedId] = useState(player.hand[0]?.id);
  const selected = player.hand.find((card) => card.id === selectedId) ?? player.hand[0];
  const rules = selected && !isNumber(selected) ? CARD_DEFS[selected.name].text : null;
  const phone = useScreen() === 'phone';

  useEffect(() => {
    done.current?.focus();
  }, []);

  return (
    <div className="overlay revealed-overlay">
      <div
        className="panel revealed-hand"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="prompt"
        style={{ transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onDone();
          if (event.key !== 'Tab') return;
          const firstCard = grid.current?.querySelector('button');
          if (event.shiftKey && event.target === firstCard) {
            event.preventDefault();
            done.current?.focus();
          } else if (event.target === done.current && (!event.shiftKey || !firstCard)) {
            event.preventDefault();
            firstCard?.focus();
          }
        }}
      >
        <div className="revealed-heading">
          <div className="revealed-effect">Wisdom of Caterpillar</div>
          <h1 id={titleId}>{player.name}’s hand</h1>
        </div>
        {selected ? (
          <div className="revealed-content">
            <div className="revealed-browser">
              <p>{player.hand.length} {player.hand.length === 1 ? 'card' : 'cards'} · Select a card to inspect it.</p>
              <div className="revealed-grid" ref={grid}>
                {player.hand.map((card) => (
                  <Card
                    key={card.id}
                    card={card}
                    faceUp
                    size={phone ? 'hand-phone' : 'hand'}
                    selected={card.id === selected.id}
                    onClick={() => setSelectedId(card.id)}
                  />
                ))}
              </div>
              {rules ? <p className="revealed-rules">{rules}</p> : null}
            </div>
            <div className="revealed-detail" data-testid="revealed-card">
              <Card card={selected} faceUp size="preview-sm" />
              <strong>{cardLabel(selected)}</strong>
            </div>
          </div>
        ) : <p>This hand is empty.</p>}
        <div className="revealed-footer">
          <button type="button" className="btn primary" ref={done} onClick={onDone}>Done</button>
        </div>
      </div>
    </div>
  );
}
