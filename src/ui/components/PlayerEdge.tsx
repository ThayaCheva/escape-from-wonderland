import type { ReactNode } from 'react';
import type { Card as CardT, Edge, GameState, Seat } from '../../engine/types';
import { hasCheshire, isImmune } from '../../engine/rules';
import { EDGE_ROTATION } from '../layout';
import { aliceImage } from '../assets';
import { Hand } from './Hand';
import { edgeBox } from '../geometry';
import { useScreen } from '../screen';

/** Where each edge's strip sits on the 1600x900 stage, and its unrotated size. */
export const EDGE_BOXES: Record<Edge, { cx: number; cy: number; length: number; depth: number }> = {
  bottom: { cx: 800, cy: 825, length: 1100, depth: 150 },
  top: { cx: 800, cy: 75, length: 1100, depth: 150 },
  left: { cx: 125, cy: 450, length: 600, depth: 250 },
  right: { cx: 1475, cy: 450, length: 600, depth: 250 },
};

const PLATE_WIDTH = 230;

export function playerStatus(state: GameState, seat: Seat, connected = true): string[] {
  const p = state.players[seat];
  const chips: string[] = [];
  if (!connected) chips.push('Disconnected');
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
  /** Overrides the player's own edge (online: placed relative to the viewer). */
  edge?: Edge;
  /** Online: keep the plate readable from the bottom of the screen. */
  upright?: boolean;
  /** Online: whether this edge belongs to the person at this screen. */
  viewer?: boolean;
  connected?: boolean;
  faceUp: boolean;
  glowing: boolean;
  targetable?: boolean;
  onPlateClick?: () => void;
  selectedIds?: string[];
  isDimmed?: (card: CardT) => boolean;
  onCardClick?: (card: CardT, index: number) => void;
  onCardPointerDown?: (card: CardT, e: React.PointerEvent) => void;
  onCardHover?: (card: CardT | null) => void;
  cardSize?: 'hand' | 'hand-lg' | 'hand-phone';
  /** Extra line under the name (location, and for you its effect). */
  where?: string;
  /** Plays right after the current player. */
  next?: boolean;
  controls?: ReactNode;
}

export function PlayerEdge({ state, seat, edge: edgeOverride, upright, viewer, connected = true, faceUp, glowing, targetable, onPlateClick, selectedIds, isDimmed, onCardClick, onCardPointerDown, onCardHover, cardSize, where, next, controls }: Props) {
  const player = state.players[seat];
  const edge = edgeOverride ?? player.edge;
  const box = edgeBox(useScreen(), edge);
  const rotation = EDGE_ROTATION[edge];
  const classes = ['player-edge', `edge-${edge}`];
  if (glowing) classes.push('glowing');
  if (player.down) classes.push('is-down');
  return (
    <div
      className={classes.join(' ')}
      data-seat={seat}
      data-viewer={viewer === undefined ? undefined : String(viewer)}
      style={{
        width: box.length,
        height: box.depth,
        left: box.cx - box.length / 2,
        top: box.cy - box.depth / 2,
        transform: `rotate(${rotation}deg)`,
      }}
    >
      <div
        className={`plate${targetable ? ' targetable' : ''}`}
        style={{ width: PLATE_WIDTH, transform: upright && rotation ? `rotate(${-rotation}deg)` : undefined }}
        onClick={targetable ? onPlateClick : undefined}
        role={targetable ? 'button' : undefined}
      >
        <img className="plate-portrait" src={aliceImage(player.alice)} alt="" />
        <div className="plate-info">
          <div className="plate-name">{player.name}</div>
          <div className="plate-count">
            {player.hand.length} card{player.hand.length === 1 ? '' : 's'}
          </div>
          {where ? <div className="plate-where">{where}</div> : null}
          <div className="plate-chips">
            {[...playerStatus(state, seat, connected), ...(next ? ['Next'] : [])].map((c) => (
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
        onCardPointerDown={onCardPointerDown}
        onCardHover={onCardHover}
        size={cardSize}
      />
    </div>
  );
}
