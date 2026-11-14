import { useEffect, useRef, useState } from 'react';
import type { GameState, LocationId, Position } from '../../engine/types';
import { LOCATIONS, LOCATION_NAMES } from '../../engine/board';
import { BOARD_IMAGE, aliceImage } from '../assets';
import { DECK_BOX, DISCARD_BOX, LOCATION_AREAS, PILE_POINT, TOKEN_SLOTS } from '../boardGeometry';
import { loadMasks, locationAt, maskUrl, type Masks } from '../locationMasks';
import { activeEffectLines } from '../info';
import { Card, CARD_SIZES } from './Card';

export const BOARD_BOX = { left: 358, top: 150, width: 884, height: 600 };

interface Props {
  state: GameState;
  selectableLocations?: LocationId[];
  onLocationClick?: (loc: LocationId) => void;
  /** Locations to glow without being clickable (e.g. where a dragged Event card can be played). */
  glowLocations?: LocationId[];
  selectableActive?: number[];
  onActiveClick?: (index: number) => void;
  /** True while a card is being dragged over the board. */
  dropTarget?: boolean;
  /** The pile card id that was just played (gets a short animation). */
  freshPileId?: string | null;
  callout?: string | null;
}

export function Board(props: Props) {
  const { state, selectableLocations = [], onLocationClick, glowLocations = [], selectableActive = [], onActiveClick } = props;
  const [masks, setMasks] = useState<Masks>({});
  const [hovered, setHovered] = useState<LocationId | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    loadMasks().then((m) => live && setMasks(m));
    return () => {
      live = false;
    };
  }, []);

  const pointToLocation = (e: React.MouseEvent): LocationId | null => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || selectableLocations.length === 0) return null;
    return locationAt(masks, ((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100, selectableLocations);
  };

  const slotIndex: Partial<Record<Position, number>> = {};
  const tokens = state.players.map((p, seat) => {
    const i = slotIndex[p.position] ?? 0;
    slotIndex[p.position] = i + 1;
    return { seat, alice: p.alice, name: p.name, slot: TOKEN_SLOTS[p.position][i % 4] };
  });
  const pileShown = state.pile.slice(-4);
  const discardTop = state.discard[state.discard.length - 1];
  const { w: pw } = CARD_SIZES.pile;
  const effects = activeEffectLines(state);
  const glowing = new Set<LocationId>([...glowLocations, ...selectableLocations]);

  return (
    <div
      ref={ref}
      className={`board${props.dropTarget ? ' drop-target' : ''}${hovered ? ' pointing' : ''}`}
      style={{ ...BOARD_BOX, backgroundImage: `url(${BOARD_IMAGE})` }}
      data-testid="board"
      onMouseMove={(e) => setHovered(pointToLocation(e))}
      onMouseLeave={() => setHovered(null)}
      onClick={(e) => {
        const loc = pointToLocation(e);
        if (loc) onLocationClick?.(loc);
      }}
    >
      {LOCATIONS.filter((l) => glowing.has(l)).map((loc) => (
        <div key={loc} className={`location-glow${hovered === loc ? ' hovered' : ''}`} aria-hidden>
          <div
            className="location-fill"
            style={{ maskImage: `url(${maskUrl(loc)})`, WebkitMaskImage: `url(${maskUrl(loc)})` }}
          />
        </div>
      ))}
      {selectableLocations.map((loc) => {
        const a = LOCATION_AREAS[loc];
        return (
          <button
            key={loc}
            className="location-area selectable"
            data-location={loc}
            style={{ left: `${a.cx}%`, top: `${a.cy}%` }}
            onClick={(e) => {
              e.stopPropagation();
              onLocationClick?.(loc);
            }}
          >
            {LOCATION_NAMES[loc].replace(/^the /, '')}
          </button>
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
            className={e.card.id === props.freshPileId ? 'fresh' : undefined}
            style={{ left: (i - (pileShown.length - 1)) * 18 - pw / 2, top: 0, zIndex: i }}
          />
        ))}
        {state.pile.length > 0 ? (
          <div className="pile-label">to beat: {state.pile[state.pile.length - 1].effective}</div>
        ) : null}
        {props.callout ? (
          <div className="callout" data-testid="callout">
            {props.callout}
          </div>
        ) : null}
      </div>

      {effects.length > 0 ? (
        <div className="effects-panel" data-testid="effects">
          <div className="effects-title">Active effects</div>
          {effects.map((e) => {
            const clickable = selectableActive.includes(e.index);
            return (
              <div
                key={e.index}
                className={`effect-row${clickable ? ' clickable' : ''}`}
                role={clickable ? 'button' : undefined}
                onClick={
                  clickable
                    ? (ev) => {
                        ev.stopPropagation();
                        onActiveClick?.(e.index);
                      }
                    : undefined
                }
              >
                {e.text}
              </div>
            );
          })}
        </div>
      ) : null}

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
