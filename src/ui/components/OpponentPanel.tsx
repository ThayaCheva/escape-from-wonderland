import type { Edge, GameState, Seat } from '../../engine/types';
import { aliceImage } from '../assets';
import { Card } from './Card';
import { playerStatus } from './PlayerEdge';

/** Where each opponent panel sits on the 1600x900 stage (centre). */
const PANEL_CENTRE: Record<Exclude<Edge, 'bottom'>, { x: number; y: number }> = {
  left: { x: 160, y: 450 },
  top: { x: 800, y: 68 },
  right: { x: 1440, y: 450 },
};
const MAX_BACKS = 8;

interface Props {
  state: GameState;
  seat: Seat;
  edge: Edge;
  glowing: boolean;
  connected: boolean;
  next: boolean;
  where: string;
  targetable: boolean;
  onPick: () => void;
}

/** Online: one upright panel per opponent with their portrait, cards (face down), location and status. */
export function OpponentPanel({ state, seat, edge, glowing, connected, next, where, targetable, onPick }: Props) {
  const player = state.players[seat];
  const centre = PANEL_CENTRE[edge === 'bottom' ? 'top' : edge];
  const shown = Math.min(player.hand.length, MAX_BACKS);
  const extra = player.hand.length - shown;
  const chips = [...playerStatus(state, seat, connected), ...(next ? ['Next'] : [])];
  return (
    <div
      className={`player-edge opponent edge-${edge}${glowing ? ' glowing' : ''}`}
      data-seat={seat}
      data-viewer="false"
      style={{ left: centre.x, top: centre.y }}
    >
      <div className={`plate${targetable ? ' targetable' : ''}`} onClick={targetable ? onPick : undefined} role={targetable ? 'button' : undefined}>
        <img className="plate-portrait" src={aliceImage(player.alice)} alt="" />
        <div className="plate-info">
          <div className="plate-name">{player.name}</div>
          <div className="plate-count">
            {player.hand.length} card{player.hand.length === 1 ? '' : 's'}
          </div>
          <div className="plate-where">{where}</div>
          <div className="plate-chips">
            {chips.map((c) => (
              <span key={c} className="chip">
                {c}
              </span>
            ))}
          </div>
        </div>
        <div className="opponent-backs">
          {Array.from({ length: shown }, (_, i) => (
            <Card key={i} card={null} faceUp={false} size="mini" style={{ left: i * 18 }} />
          ))}
          {extra > 0 ? <span className="backs-extra">+{extra}</span> : null}
        </div>
      </div>
    </div>
  );
}
