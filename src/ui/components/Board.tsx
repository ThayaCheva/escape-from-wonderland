import type { GameState, LocationId, Position } from '../../engine/types';
import { LOCATIONS, LOCATION_NAMES } from '../../engine/board';
import { BOARD_IMAGE, aliceImage } from '../assets';
import { ACTIVE_ROW, DECK_BOX, DISCARD_BOX, LOCATION_AREAS, PILE_POINT, TOKEN_SLOTS } from '../boardGeometry';
import { Card, CARD_SIZES } from './Card';

export const BOARD_BOX = { left: 358, top: 150, width: 884, height: 600 };

interface Props {
  state: GameState;
  selectableLocations?: LocationId[];
  onLocationClick?: (loc: LocationId) => void;
  selectableActive?: number[];
  onActiveClick?: (index: number) => void;
}

export function Board({ state, selectableLocations = [], onLocationClick, selectableActive = [], onActiveClick }: Props) {
  const slotIndex: Partial<Record<Position, number>> = {};
  const tokens = state.players.map((p, seat) => {
    const i = slotIndex[p.position] ?? 0;
    slotIndex[p.position] = i + 1;
    const slot = TOKEN_SLOTS[p.position][i % 4];
    return { seat, alice: p.alice, name: p.name, slot };
  });
  const pileShown = state.pile.slice(-4);
  const discardTop = state.discard[state.discard.length - 1];
  const { w: pw } = CARD_SIZES.pile;

  return (
    <div className="board" style={{ ...BOARD_BOX, backgroundImage: `url(${BOARD_IMAGE})` }}>
      {LOCATIONS.map((loc) => {
        const a = LOCATION_AREAS[loc];
        const selectable = selectableLocations.includes(loc);
        return (
          <div
            key={loc}
            className={`location-area${selectable ? ' selectable' : ''}`}
            data-location={loc}
            title={selectable ? `Move to ${LOCATION_NAMES[loc]}` : undefined}
            style={{ left: `${a.cx - a.rx}%`, top: `${a.cy - a.ry}%`, width: `${a.rx * 2}%`, height: `${a.ry * 2}%` }}
            onClick={selectable ? () => onLocationClick?.(loc) : undefined}
          />
        );
      })}

      <div className="deck-box" style={boxStyle(DECK_BOX)}>
        {state.deck.length > 0 ? <Card card={null} faceUp={false} size="pile" /> : null}
        <span className="box-count">{state.deck.length}</span>
      </div>
      <div className="discard-box" style={boxStyle(DISCARD_BOX)}>
        {discardTop ? <Card card={discardTop} faceUp size="pile" /> : null}
        <span className="box-count">{state.discard.length}</span>
      </div>

      <div className="pile" style={{ left: `${PILE_POINT.x}%`, top: `${PILE_POINT.y}%` }}>
        {pileShown.map((e, i) => (
          <Card
            key={e.card.id}
            card={e.card}
            faceUp
            size="pile"
            modifier={e.modifier}
            style={{ left: (i - (pileShown.length - 1)) * 22 - pw / 2, top: 0, zIndex: i }}
          />
        ))}
        {state.pile.length > 0 ? (
          <div className="pile-label">to beat: {state.pile[state.pile.length - 1].effective}</div>
        ) : null}
      </div>

      <div className="active-row" style={{ left: `${ACTIVE_ROW.x}%`, top: `${ACTIVE_ROW.y}%` }}>
        {state.active.map((a, i) => (
          <Card
            key={a.card.id}
            card={a.card}
            faceUp
            size="mini"
            highlight={selectableActive.includes(i)}
            onClick={selectableActive.includes(i) ? () => onActiveClick?.(i) : undefined}
            title={`${state.players[a.seat].name}'s card`}
          />
        ))}
      </div>

      {tokens.map((t) => (
        <img
          key={t.seat}
          className="token"
          src={aliceImage(t.alice)}
          alt={t.name}
          title={t.name}
          style={{ left: `${t.slot.x}%`, top: `${t.slot.y}%` }}
        />
      ))}
    </div>
  );
}

function boxStyle(b: { left: number; top: number; width: number; height: number }) {
  return { left: `${b.left}%`, top: `${b.top}%`, width: `${b.width}%`, height: `${b.height}%` };
}
