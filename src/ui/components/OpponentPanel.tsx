import type { Edge, GameState, Seat } from '../../engine/types';
import { aliceImage } from '../assets';
import { Card } from './Card';
import { playerStatus } from './PlayerEdge';
import { opponentCentre } from '../geometry';
import { useScreen } from '../screen';

/** Where each opponent panel sits on the 1600x900 stage (centre). */
const PANEL_CENTRE: Record<Exclude<Edge, 'bottom'>, { x: number; y: number }> = {
  left: { x: 160, y: 450 },
  top: { x: 800, y: 68 },
  right: { x: 1440, y: 450 },
};
const MAX_BACKS = 8;
const MAX_BACKS_PHONE = 5;

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
  /** Phone: position in the stack of opponents. */
  index?: number;
  count?: number;
}

/** Online: one upright panel per opponent with their portrait, cards (face down), location and status. */
export function OpponentPanel({ state, seat, edge, glowing, connected, next, where, targetable, onPick, index = 0, count = 1 }: Props) {
  const player = state.players[seat];
  const kind = useScreen();
  const centre = opponentCentre(kind, edge, index, count);
  const shown = Math.min(player.hand.length, kind === 'phone' ? MAX_BACKS_PHONE : MAX_BACKS);
  const extra = player.hand.length - shown;
  const chips = [...playerStatus(state, seat, connected), ...(next ? ['Next'] : [])];
  return (
    <div
      className={`player-edge opponent edge-${edge}${glowing ? ' glowing' : ''}${player.down ? ' is-down' : ''}`}
      data-seat={seat}
      data-viewer="false"
      style={{ left: centre.x, top: centre.y }}
    >
      <div className={`plate${targetable ? ' targetable' : ''}`}>
        {targetable ? <button type="button" className="plate-target" aria-label={`Choose ${player.name}`} onClick={onPick} /> : null}
        <img className="plate-portrait" src={aliceImage(player.alice)} alt="" />
        <div className="plate-info">
          <div className="plate-name" title={player.name}>{player.name}</div>
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
