import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { CardName, Edge, GameState, Seat } from '../../engine/types';
import { CARD_DEFS } from '../../engine/cards';
import type { Anim } from '../animationEvents';
import { BOARD_CENTRE, DECK_POINT, DISCARD_POINT, EFFECTS_POINT, PILE_POINT_STAGE, seatAnchors, tokenPoint, type Point } from '../anchors';
import { aliceImage } from '../assets';
import { Card } from './Card';

interface Item {
  id: number;
  node: ReactNode;
}

interface Props {
  /** A batch of moments to animate; a new `id` means a new batch. */
  batch: { id: number; anims: Anim[] } | null;
  state: GameState;
  /** Where each seat sits on this screen. */
  edgeOf: (seat: Seat) => Edge;
  online: boolean;
  viewerSeat?: Seat;
}

const SPECIAL_MS = 1500;
const BANNER_MS = 1300;
const ROUND_MS = 1900;
const FLIGHT_MS = 650;
const STAGGER_MS = 120;
const WIN_MS = 2500;

let nextId = 1;
const particles = (n: number, spread: number) =>
  Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const dist = spread * (0.6 + Math.random() * 0.6);
    return { tx: Math.cos(angle) * dist, ty: Math.sin(angle) * dist, delay: Math.random() * 120 };
  });

function Flight({ from, to, delay, faceDown = true, card }: { from: Point; to: Point; delay: number; faceDown?: boolean; card?: CardName }) {
  const style = {
    left: from.x,
    top: from.y,
    '--dx': `${to.x - from.x}px`,
    '--dy': `${to.y - from.y}px`,
    animationDelay: `${delay}ms`,
  } as CSSProperties;
  return (
    <div className="anim-flight" style={style}>
      <Card card={card ? { id: 'anim', kind: CARD_DEFS[card].kind, name: card } : null} faceUp={!faceDown} size="mini" />
    </div>
  );
}

function Sparkles({ at, n = 18, spread = 170, delay = 0 }: { at: Point; n?: number; spread?: number; delay?: number }) {
  return (
    <>
      {particles(n, spread).map((p, i) => (
        <span
          key={i}
          className="anim-particle"
          style={{ left: at.x, top: at.y, '--tx': `${p.tx}px`, '--ty': `${p.ty}px`, animationDelay: `${delay + p.delay}ms` } as CSSProperties}
        />
      ))}
    </>
  );
}

export function Animations({ batch, state, edgeOf, online, viewerSeat }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  // specials and banners each play one after another; this is when each channel is free again
  const free = useRef({ special: 0, banner: 0 });

  useEffect(() => {
    if (!batch) return;
    const now = Date.now();
    const anchor = (seat: Seat) => seatAnchors(edgeOf(seat), online && seat !== viewerSeat);
    const name = (seat: Seat) => state.players[seat].name;
    const add = (node: ReactNode, startIn: number, lasts: number) => {
      const id = nextId++;
      const show = () => {
        setItems((list) => [...list, { id, node }]);
        setTimeout(() => setItems((list) => list.filter((it) => it.id !== id)), lasts);
      };
      if (startIn > 0) setTimeout(show, startIn);
      else show();
    };
    // special cards and banners share one queue, so a banner never covers a card being announced
    const inChannel = (_channel: 'special' | 'banner', lasts: number) => {
      const start = Math.max(now, free.current.special, free.current.banner);
      free.current.special = free.current.banner = start + lasts;
      return start - now;
    };

    for (const a of batch.anims) {
      switch (a.kind) {
        case 'special': {
          const def = CARD_DEFS[a.name];
          const from = anchor(a.seat).hand;
          add(
            <div className="anim-special" style={{ left: BOARD_CENTRE.x, top: BOARD_CENTRE.y, '--fx': `${from.x - BOARD_CENTRE.x}px`, '--fy': `${from.y - BOARD_CENTRE.y}px` } as CSSProperties}>
              <Card card={{ id: 'anim', kind: def.kind, name: a.name }} faceUp size="preview" />
              <div className="anim-caption">
                {name(a.seat)} plays {def.title}
              </div>
            </div>,
            inChannel('special', SPECIAL_MS),
            SPECIAL_MS,
          );
          add(<Sparkles at={BOARD_CENTRE} delay={350} />, free.current.special - SPECIAL_MS - now, SPECIAL_MS);
          break;
        }
        case 'draw': {
          const to = anchor(a.seat).hand;
          for (let i = 0; i < Math.min(a.count, 6); i++) add(<Flight from={DECK_POINT} to={to} delay={i * STAGGER_MS} />, 0, FLIGHT_MS + i * STAGGER_MS + 50);
          break;
        }
        case 'discard': {
          const from = anchor(a.seat).hand;
          for (let i = 0; i < Math.min(a.count, 6); i++) add(<Flight from={from} to={DISCARD_POINT} delay={i * STAGGER_MS} />, 0, FLIGHT_MS + i * STAGGER_MS + 50);
          break;
        }
        case 'sweep':
          for (let i = 0; i < 3; i++) add(<Flight from={PILE_POINT_STAGE} to={DISCARD_POINT} delay={i * 80} faceDown />, 0, FLIGHT_MS + 300);
          break;
        case 'party': {
          const n = state.players.length;
          for (let s = 0; s < n; s++) {
            // a hand passes to the right: to the previous player in turn order
            add(<Flight from={anchor(s).hand} to={anchor((s - 1 + n) % n).hand} delay={0} />, 0, FLIGHT_MS + 100);
          }
          break;
        }
        case 'swap':
          add(<Flight from={anchor(a.a).hand} to={anchor(a.b).hand} delay={0} />, 0, FLIGHT_MS + 100);
          add(<Flight from={anchor(a.b).hand} to={anchor(a.a).hand} delay={STAGGER_MS} />, 0, FLIGHT_MS + 200);
          break;
        case 'peek': {
          const p = anchor(a.a).plate;
          const q = anchor(a.b).plate;
          const len = Math.hypot(q.x - p.x, q.y - p.y);
          const angle = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
          add(<div className="anim-link" style={{ left: p.x, top: p.y, width: len, transform: `rotate(${angle}deg)` }} />, 0, 1400);
          add(<div className="anim-pulse" style={{ left: p.x, top: p.y }} />, 0, 1400);
          add(<div className="anim-pulse" style={{ left: q.x, top: q.y }} />, 0, 1400);
          break;
        }
        case 'slay':
          add(
            <div className="anim-slay" style={{ left: EFFECTS_POINT.x, top: EFFECTS_POINT.y }}>
              Slain: {a.title}
            </div>,
            0,
            1500,
          );
          break;
        case 'down': {
          const p = anchor(a.seat).plate;
          add(
            <div className="anim-stamp" style={{ left: p.x, top: p.y }}>
              Down
            </div>,
            0,
            1200,
          );
          break;
        }
        case 'round':
          add(
            <div className="anim-banner round">
              <div className="banner-big">{a.round === 1 ? 'Round 1' : `Round ${a.round - 1} over`}</div>
              <div className="banner-small">
                {a.round === 1 ? `${name(a.starter)} goes first` : `Round ${a.round} begins · ${name(a.starter)} starts`}
              </div>
            </div>,
            inChannel('banner', ROUND_MS),
            ROUND_MS,
          );
          break;
        case 'turn':
          if (!online) break; // one screen: the hand-off banner announces turns
          add(
            <div className={`anim-banner turn${a.seat === viewerSeat ? ' mine' : ''}`}>
              <div className="banner-big">{a.seat === viewerSeat ? 'Your turn' : `${name(a.seat)}'s turn`}</div>
            </div>,
            inChannel('banner', BANNER_MS),
            BANNER_MS,
          );
          break;
        case 'win': {
          const from = tokenPoint(state.players[a.seat].position, 0);
          add(
            <>
              <img className="anim-escape" src={aliceImage(state.players[a.seat].alice)} alt="" style={{ left: from.x, top: from.y }} />
              <Sparkles at={from} n={30} spread={260} />
              <div className="anim-banner win">
                <div className="banner-big">{name(a.seat)} escapes Wonderland!</div>
              </div>
            </>,
            0,
            WIN_MS,
          );
          break;
        }
        case 'reveal':
          break; // the board flips the starting cards itself
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch?.id]);

  return (
    <div className="animations" aria-hidden>
      {items.map((it) => (
        <div key={it.id}>{it.node}</div>
      ))}
    </div>
  );
}
