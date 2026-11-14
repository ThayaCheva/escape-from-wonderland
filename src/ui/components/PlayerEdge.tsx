import type { ReactNode } from 'react';
import type { Card as CardT, Edge, GameState, Seat } from '../../engine/types';
import { hasCheshire, isImmune } from '../../engine/rules';
import { EDGE_ROTATION } from '../layout';
import { aliceImage } from '../assets';
import { Hand } from './Hand';

/** Where each edge's strip sits on the 1600x900 stage, and its unrotated size. */
export const EDGE_BOXES: Record<Edge, { cx: number; cy: number; length: number; depth: number }> = {
  bottom: { cx: 800, cy: 825, length: 1100, depth: 150 },
  top: { cx: 800, cy: 75, length: 1100, depth: 150 },
  left: { cx: 125, cy: 450, length: 600, depth: 250 },
  right: { cx: 1475, cy: 450, length: 600, depth: 250 },
};

const PLATE_WIDTH = 230;

export function playerStatus(state: GameState, seat: Seat): string[] {
  const p = state.players[seat];
  const chips: string[] = [];
  if (state.phase === 'playing' && state.current === seat) chips.push('Their turn');
  if (p.down) chips.push('Down');
  if (hasCheshire(state, seat)) chips.push('Immune (Cheshire)');
  else if (isImmune(state, seat, { kind: 'event', bySeat: -1 })) chips.push('Immune to events');
  if (p.drinkMeLock !== 'none') chips.push('Drink Me: numbers only');
  if (p.skipNextTurn) chips.push('Skips next turn');
  return chips;
}

interface Props {
  state: GameState;
  seat: Seat;
  faceUp: boolean;
  glowing: boolean;
  targetable?: boolean;
  onPlateClick?: () => void;
  selectedIds?: string[];
  isDimmed?: (card: CardT) => boolean;
  onCardClick?: (card: CardT, index: number) => void;
  controls?: ReactNode;
}

export function PlayerEdge({ state, seat, faceUp, glowing, targetable, onPlateClick, selectedIds, isDimmed, onCardClick, controls }: Props) {
  const player = state.players[seat];
  const box = EDGE_BOXES[player.edge];
  const classes = ['player-edge', `edge-${player.edge}`];
  if (glowing) classes.push('glowing');
  return (
    <div
      className={classes.join(' ')}
      data-seat={seat}
      style={{
        width: box.length,
        height: box.depth,
        left: box.cx - box.length / 2,
        top: box.cy - box.depth / 2,
        transform: `rotate(${EDGE_ROTATION[player.edge]}deg)`,
      }}
    >
      <div
        className={`plate${targetable ? ' targetable' : ''}`}
        style={{ width: PLATE_WIDTH }}
        onClick={targetable ? onPlateClick : undefined}
        role={targetable ? 'button' : undefined}
      >
        <img className="plate-portrait" src={aliceImage(player.alice)} alt="" />
        <div className="plate-info">
          <div className="plate-name">{player.name}</div>
          <div className="plate-count">
            {player.hand.length} card{player.hand.length === 1 ? '' : 's'}
          </div>
          <div className="plate-chips">
            {playerStatus(state, seat).map((c) => (
              <span key={c} className="chip">
                {c}
              </span>
            ))}
          </div>
        </div>
        {controls ? <div className="plate-controls">{controls}</div> : null}
      </div>
      <Hand
        cards={player.hand}
        faceUp={faceUp}
        length={box.length - PLATE_WIDTH - 30}
        selectedIds={selectedIds}
        isDimmed={isDimmed}
        onCardClick={onCardClick}
      />
    </div>
  );
}
