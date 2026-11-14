import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Card as CardT, Edge, GameAction, GameState, LocationId } from '../../engine/types';
import { actingSeat } from '../../engine/step';
import { checkPlay } from '../../engine/rules';
import { CARD_DEFS, isNumber } from '../../engine/cards';
import { changedSince, dropAction, lastPlayLine, locationLine, nextSeatToAct, passNeedsConfirm } from '../info';
import { Card } from './Card';
import { setSoundOn, soundOn } from '../sound';
import { LOCATIONS } from '../../engine/board';
import { BACKGROUND_IMAGE } from '../assets';
import { EDGE_ROTATION, edgeFor } from '../layout';
import { confirm, faceUpHandSeat, needsHandoff, type UiGate } from '../visibility';
import { Board } from './Board';
import { CardPreview } from './CardPreview';
import { GameLog } from './GameLog';
import { HandoffBanner } from './HandoffBanner';
import { PlayerEdge } from './PlayerEdge';
import { OpponentPanel } from './OpponentPanel';
import { PromptPanel } from './PromptPanel';
import { RulesPanel } from './RulesPanel';
import { Stage } from './Stage';

interface Props {
  state: GameState;
  dispatch: (a: GameAction) => string | null;
  onQuit: () => void;
  /** Online: the seat whose screen this is. Unset means one shared screen (hot-seat). */
  viewerSeat?: number;
  /** Online: which seats are currently connected. */
  connected?: boolean[];
  /** A message to flash (e.g. an error the server sent back). */
  notice?: { message: string; n: number } | null;
  /** Online: this browser's connection is down. */
  offline?: boolean;
}

const WAITING_FOR: Partial<Record<string, string>> = {
  'setup-pick': 'is choosing a starting card',
  'drink-me-extra': 'is playing extra cards',
  'eat-me': 'is choosing cards to eat',
  'vorpal-target': 'is choosing what to slay',
  'execution-declare': 'is declaring a number',
  'execution-choose': 'is choosing which card to play',
  'choose-player': 'is choosing a player',
  'view-hand': 'is looking at a hand',
  'exile-location': 'is choosing a location',
  'vines-take': 'is taking a card',
  'vines-give': 'is choosing a card to give',
  discard: 'is choosing cards to discard',
  'round-end-move': 'is choosing where to move',
};

/** Where the prompt panel sits for each acting edge (stage coordinates). */
const PANEL_POS: Record<Edge, { x: number; y: number }> = {
  bottom: { x: 800, y: 680 },
  top: { x: 800, y: 220 },
  left: { x: 480, y: 450 },
  right: { x: 1120, y: 450 },
};

/** For prompts that need the board clicked, a compact panel sits over the player's own hand area instead. */
const PANEL_POS_EDGE: Record<Edge, { x: number; y: number }> = {
  bottom: { x: 922, y: 825 },
  top: { x: 678, y: 75 },
  left: { x: 125, y: 572 },
  right: { x: 1475, y: 328 },
};
const BOARD_PROMPTS = new Set(['exile-location', 'round-end-move', 'vorpal-target']);

const MULTI_SELECT = new Set(['eat-me', 'discard']);
const SINGLE_SELECT = new Set(['execution-choose', 'vines-give']);

export function Table({ state, dispatch, onQuit, viewerSeat, connected, notice, offline }: Props) {
  const [gate, setGate] = useState<UiGate>({ confirmedSeat: null, peeked: false });
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [drag, setDrag] = useState<{ card: CardT; x: number; y: number; over: boolean } | null>(null);
  const [hoverCard, setHoverCard] = useState<CardT | null>(null);
  const [confirmPass, setConfirmPass] = useState(false);
  const [callout, setCallout] = useState<string | null>(null);
  const [freshPileId, setFreshPileId] = useState<string | null>(null);
  const [sound, setSound] = useState(soundOn);
  const suppressClick = useRef(false);
  const lastSeen = useRef<{ play: string | null; pileTop: string | null } | null>(null);
  const latest = useRef(state);
  latest.current = state;
  const endDrag = useRef<(() => void) | null>(null);
  useEffect(() => () => endDrag.current?.(), []);

  const prompt = state.prompts[0];
  const acting = actingSeat(state);
  const online = viewerSeat !== undefined;
  const edgeOf = (seat: number): Edge =>
    online ? edgeFor(seat, viewerSeat, state.players.length) : state.players[seat].edge;
  const actingEdge = edgeOf(acting);
  const rotation = online ? 0 : EDGE_ROTATION[actingEdge];
  const handoff = online ? false : needsHandoff(state, gate);
  const faceSeat = online ? viewerSeat : faceUpHandSeat(state, gate);
  /** True when the person at this screen is the one who must act. */
  const mine = !online || acting === viewerSeat;
  const canAct = !handoff && mine;
  const myTurnNoPrompt = !online && !handoff && !prompt;

  // clear transient selections whenever the situation changes
  const situation = `${state.log.length}|${state.prompts.length}|${prompt?.type}|${acting}`;
  useEffect(() => {
    setSelected([]);
    setPreview(null);
  }, [situation]);

  useEffect(() => {
    if (notice) setToast(notice.message);
  }, [notice]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const send = (a: GameAction) => {
    const err = dispatch(a);
    if (err) setToast(err);
  };

  // a short callout and a "pop" on the pile whenever someone plays a card
  const newest = state.log[state.log.length - 1];
  const pileTop = state.pile[state.pile.length - 1]?.card.id ?? null;
  useEffect(() => {
    const play = lastPlayLine(state.log);
    const seen = lastSeen.current;
    const newPlay = changedSince(seen ? seen.play : undefined, play);
    const newTop = changedSince(seen ? seen.pileTop : undefined, pileTop);
    if (newPlay) setCallout(newPlay);
    if (newTop) setFreshPileId(newTop);
    lastSeen.current = { play, pileTop };
  }, [newest, state.log.length, pileTop]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!callout) return;
    const t = setTimeout(() => setCallout(null), 4000);
    return () => clearTimeout(t);
  }, [callout]);

  useEffect(() => setConfirmPass(false), [acting, prompt?.type]);

  const overBoard = (x: number, y: number) => {
    const r = document.querySelector('[data-testid="board"]')?.getBoundingClientRect();
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  /** Press on a card in your hand: a click previews it, a drag onto the board plays it. */
  function onCardPointerDown(card: CardT, e: React.PointerEvent) {
    if (e.button !== 0 || handoff || faceSeat !== acting || endDrag.current) return;
    const start = { x: e.clientX, y: e.clientY };
    const seat = acting;
    let dragging = false;
    const move = (ev: PointerEvent) => {
      if (!dragging && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) {
        dragging = true;
        setHoverCard(null);
      }
      if (dragging) setDrag({ card, x: ev.clientX, y: ev.clientY, over: overBoard(ev.clientX, ev.clientY) });
    };
    // an interrupted drag (switching windows, the system taking the pointer) is simply cancelled
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('blur', stop);
      endDrag.current = null;
      setDrag(null);
    };
    const up = (ev: PointerEvent) => {
      stop();
      if (!dragging) return;
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 0);
      if (!overBoard(ev.clientX, ev.clientY)) return;
      // decide against the game as it is now, not as it was when the drag began
      const result = dropAction(latest.current, seat, card.id);
      if ('action' in result) send(result.action);
      else setToast(result.reason);
    };
    endDrag.current = stop;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('blur', stop);
  }

  const previewCard = preview ? state.players[acting].hand.find((c) => c.id === preview) ?? null : null;

  function onOwnCardClick(card: CardT) {
    if (suppressClick.current || handoff || faceSeat !== acting) return;
    if (!prompt || prompt.type === 'drink-me-extra' || prompt.type === 'setup-pick') {
      setPreview(card.id);
      return;
    }
    if (MULTI_SELECT.has(prompt.type)) {
      setSelected((s) => (s.includes(card.id) ? s.filter((x) => x !== card.id) : [...s, card.id]));
    } else if (SINGLE_SELECT.has(prompt.type)) {
      setSelected((s) => (s[0] === card.id ? [] : [card.id]));
    }
  }

  function previewInfo(card: CardT): { label: string; reason: string | null; action: GameAction } {
    if (prompt?.type === 'setup-pick') {
      return {
        label: 'Choose',
        reason: isNumber(card) ? null : 'Choose a number card.',
        action: { type: 'setup-pick', seat: acting, cardId: card.id },
      };
    }
    const check = checkPlay(state, acting, card.id, { free: prompt?.type === 'drink-me-extra' });
    return { label: 'Play', reason: check.ok ? null : check.reason, action: { type: 'play', seat: acting, cardId: card.id } };
  }

  const dimmed = (card: CardT) => {
    if (prompt?.type === 'setup-pick') return !isNumber(card);
    if (!prompt) return !checkPlay(state, acting, card.id).ok;
    if (prompt.type === 'drink-me-extra') return !checkPlay(state, acting, card.id, { free: true }).ok;
    if (prompt.type === 'eat-me') return !(isNumber(card) && card.value <= 5);
    if (prompt.type === 'execution-choose') return !(isNumber(card) && card.value === prompt.value);
    if (prompt.type === 'vines-give') return card.id === prompt.takenCardId;
    return false;
  };

  // board selections
  let selectableLocations: LocationId[] = [];
  let onLocationClick: ((l: LocationId) => void) | undefined;
  if (canAct && prompt?.type === 'exile-location') {
    const from = state.players[prompt.target].position;
    selectableLocations = LOCATIONS.filter((l) => l !== from);
    onLocationClick = (l) => send({ type: 'choose-location', seat: acting, location: l });
  } else if (canAct && prompt?.type === 'round-end-move') {
    selectableLocations = [...LOCATIONS];
    onLocationClick = (l) => send({ type: 'choose-location', seat: acting, location: l });
  }
  const selectableActive =
    canAct && prompt?.type === 'vorpal-target'
      ? state.active.map((a, i) => (a.card.name === 'cheshire-cat' ? -1 : i)).filter((i) => i >= 0)
      : [];
  const targetSeats = canAct && prompt?.type === 'choose-player' ? prompt.options : [];

  const actingPlayer = state.players[acting];
  const dragDef = drag && !isNumber(drag.card) ? CARD_DEFS[drag.card.name] : null;
  const dragLocation = dragDef?.kind === 'event' ? dragDef.location : null;
  const hovered =
    hoverCard && !drag && faceSeat !== null && state.players[faceSeat].hand.some((c) => c.id === hoverCard.id) ? hoverCard : null;
  const controls = (seat: number) => {
    if (seat !== acting || !canAct) return null;
    if (!prompt) {
      return (
        <>
          {online ? null : (
            <button className="btn small" onClick={() => setGate({ ...gate, peeked: !gate.peeked })}>
              {gate.peeked ? 'Hide' : 'Peek'}
            </button>
          )}
          <button
            className={`btn small${confirmPass ? ' confirm' : ''}`}
            onClick={() => {
              // passing while holding a playable card asks once more
              if (!confirmPass && !actingPlayer.down && passNeedsConfirm(state, seat, { online, peeked: gate.peeked })) {
                setConfirmPass(true);
                setTimeout(() => setConfirmPass(false), 3000);
                return;
              }
              send({ type: 'pass', seat });
            }}
          >
            {confirmPass ? 'Pass anyway?' : actingPlayer.down ? 'Stay down' : 'Pass'}
          </button>
        </>
      );
    }
    return null;
  };

  return (
    <Stage background={BACKGROUND_IMAGE}>
      <Board
        state={state}
        selectableLocations={selectableLocations}
        onLocationClick={onLocationClick}
        selectableActive={selectableActive}
        onActiveClick={(i) => send({ type: 'choose-active', seat: acting, index: i })}
        dropTarget={drag?.over ?? false}
        glowLocations={dragLocation ? [dragLocation] : []}
        freshPileId={freshPileId}
        callout={callout}
      />
      {state.players.map((_, seat) =>
        online && seat !== viewerSeat ? (
          <OpponentPanel
            key={seat}
            state={state}
            seat={seat}
            edge={edgeOf(seat)}
            glowing={seat === acting}
            connected={connected ? connected[seat] !== false : true}
            next={state.phase === 'playing' && seat === nextSeatToAct(state) && seat !== state.current}
            where={locationLine(state, seat, false)}
            targetable={targetSeats.includes(seat)}
            onPick={() => send({ type: 'choose-seat', seat: acting, target: seat })}
          />
        ) : (
        <PlayerEdge
          key={seat}
          state={state}
          seat={seat}
          edge={edgeOf(seat)}
          upright={online}
          viewer={online ? seat === viewerSeat : undefined}
          connected={connected ? connected[seat] !== false : true}
          faceUp={faceSeat === seat}
          glowing={seat === acting}
          targetable={targetSeats.includes(seat)}
          onPlateClick={() => send({ type: 'choose-seat', seat: acting, target: seat })}
          selectedIds={seat === acting ? selected : []}
          isDimmed={seat === acting ? dimmed : online && seat === viewerSeat ? () => true : undefined}
          onCardClick={seat === acting && faceSeat === acting ? onOwnCardClick : undefined}
          onCardPointerDown={seat === acting && faceSeat === acting ? onCardPointerDown : undefined}
          onCardHover={faceSeat === seat ? setHoverCard : undefined}
          cardSize={online && seat === viewerSeat ? 'hand-lg' : 'hand'}
          where={locationLine(state, seat, seat === (online ? viewerSeat : acting))}
          next={state.phase === 'playing' && seat === nextSeatToAct(state) && seat !== state.current}
          controls={controls(seat)}
        />
        ),
      )}

      <div className="corner corner-tl">
        <GameLog lines={state.log} />
      </div>
      <div className="corner corner-tr">
        <button className="btn small" onClick={() => setShowRules(true)}>
          Rules
        </button>
        {online ? (
          <button
            className="btn small"
            title="A short chime when it becomes your turn"
            onClick={() => {
              setSoundOn(!sound);
              setSound(!sound);
            }}
          >
            Sound: {sound ? 'on' : 'off'}
          </button>
        ) : null}
        <button className="btn small" onClick={onQuit}>
          Menu
        </button>
        <div className="round-info">Round {state.round}</div>
      </div>

      {canAct && prompt ? (
        (() => {
          const compact = BOARD_PROMPTS.has(prompt.type);
          const pos = (compact ? PANEL_POS_EDGE : PANEL_POS)[actingEdge];
          return (
            <div className="prompt-anchor" style={{ left: pos.x, top: pos.y }}>
              <PromptPanel state={state} prompt={prompt} rotation={rotation} selectedIds={selected} send={send} compact={compact} />
            </div>
          );
        })()
      ) : null}

      {myTurnNoPrompt && !gate.peeked ? (
        <div className="prompt-anchor" style={{ left: PANEL_POS[actingEdge].x, top: PANEL_POS[actingEdge].y }}>
          <div className="prompt-panel hint" style={{ transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}>
            Click <b>Peek</b> to look at your cards.
          </div>
        </div>
      ) : null}

      {previewCard && !handoff ? (
        (() => {
          const info = previewInfo(previewCard);
          return (
            <CardPreview
              card={previewCard}
              rotation={rotation}
              actionLabel={info.label}
              reason={info.reason}
              onAction={() => send(info.action)}
              onCancel={() => setPreview(null)}
            />
          );
        })()
      ) : null}

      {online && !mine && state.phase !== 'game-over' ? (
        <div className="waiting-banner" data-testid="waiting">
          {connected && connected[acting] === false
            ? `Waiting for ${state.players[acting].name} to reconnect…`
            : prompt && WAITING_FOR[prompt.type]
              ? `${state.players[acting].name} ${WAITING_FOR[prompt.type]}…`
              : `Waiting for ${state.players[acting].name}…`}
        </div>
      ) : null}
      {hovered ? (
        online ? (
          <div className="hover-preview" style={{ left: 380, top: 268 }}>
            <Card card={hovered} faceUp size="preview" />
          </div>
        ) : (
          <div className="hover-preview" style={{ left: 800, top: 450, transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}>
            <Card card={hovered} faceUp size="preview" />
          </div>
        )
      ) : null}
      {drag
        ? // drawn outside the scaled stage so it sits exactly under the pointer at any window size
          createPortal(
            <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
              <Card card={drag.card} faceUp size="hand-lg" />
            </div>,
            document.body,
          )
        : null}
      {offline ? (
        <div className="offline-bar" data-testid="offline">
          Reconnecting…
        </div>
      ) : null}
      {toast ? <div className="toast">{toast}</div> : null}
      {showRules ? <RulesPanel onClose={() => setShowRules(false)} /> : null}
      {handoff ? <HandoffBanner state={state} onConfirm={() => setGate(confirm(state))} /> : null}
    </Stage>
  );
}
