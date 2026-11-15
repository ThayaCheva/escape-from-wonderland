import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Card as CardT, Edge, GameAction, GameState, LocationId } from '../../engine/types';
import { actingSeat } from '../../engine/step';
import { checkPlay } from '../../engine/rules';
import { CARD_DEFS, isNumber } from '../../engine/cards';
import { changedSince, dropAction, lastPlayLine, locationLine, nextSeatToAct, passNeedsConfirm, shouldAutoPass } from '../info';
import { Card } from './Card';
import { Animations } from './Animations';
import { detectAnimations, type Anim } from '../animationEvents';
import { setSoundOn, soundOn } from '../sound';
import { useScreen } from '../screen';
import { PHONE_PANEL } from '../geometry';
import { anchorsFor } from '../anchors';
import { LOCATIONS } from '../../engine/board';
import { TABLE_IMAGE } from '../assets';
import { EDGE_ROTATION, edgeFor } from '../layout';
import { confirm, faceUpHandSeat, needsHandoff, type UiGate } from '../visibility';
import { Board } from './Board';
import { CardPreview } from './CardPreview';
import { GameLog } from './GameLog';
import { HandoffBanner } from './HandoffBanner';
import { PlayerEdge } from './PlayerEdge';
import { OpponentPanel } from './OpponentPanel';
import { PromptPanel } from './PromptPanel';
import { RevealedHand } from './RevealedHand';
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
  'execution-choose': 'is responding to Execution Order',
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
  // on the board, away from the player's own hand so they can plan while choosing
  bottom: { x: 800, y: 205 },
  top: { x: 800, y: 205 },
  left: { x: 425, y: 450 },
  right: { x: 1175, y: 450 },
};
const BOARD_PROMPTS = new Set(['exile-location', 'round-end-move', 'vorpal-target']);

const MULTI_SELECT = new Set(['eat-me', 'discard']);
const SINGLE_SELECT = new Set(['execution-choose', 'vines-give']);

export function Table({ state, dispatch, onQuit, viewerSeat, connected, notice, offline }: Props) {
  const [gate, setGate] = useState<UiGate>({ confirmedSeat: null, peeked: false });
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ cardId: string; seat: number; inspectOnly: boolean } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const rulesButton = useRef<HTMLButtonElement>(null);
  const [drag, setDrag] = useState<{ card: CardT; x: number; y: number; over: boolean } | null>(null);
  const [hoverCard, setHoverCard] = useState<CardT | null>(null);
  const [confirmPass, setConfirmPass] = useState(false);
  const [callout, setCallout] = useState<string | null>(null);
  const [freshPileId, setFreshPileId] = useState<string | null>(null);
  const [sound, setSound] = useState(soundOn);
  const [animBatch, setAnimBatch] = useState<{ id: number; anims: Anim[] } | null>(null);
  const [revealing, setRevealing] = useState(false);
  const animPrev = useRef<GameState | null>(null);
  useEffect(() => {
    const anims = detectAnimations(animPrev.current, state);
    animPrev.current = state;
    if (anims.length === 0) return;
    setAnimBatch({ id: Math.random(), anims });
    if (anims.some((a) => a.kind === 'reveal')) {
      setRevealing(true);
      setTimeout(() => setRevealing(false), 900);
    }
  }, [state]);
  const suppressClick = useRef(false);
  const lastSeen = useRef<{ play: string | null; pileTop: string | null } | null>(null);
  const latest = useRef(state);
  latest.current = state;
  const endDrag = useRef<(() => void) | null>(null);
  useEffect(() => () => endDrag.current?.(), []);

  const prompt = state.prompts[0];
  const acting = actingSeat(state);
  const online = viewerSeat !== undefined;
  const kind = useScreen();
  const phone = kind === 'phone';
  const anchors = anchorsFor(kind);
  /** Online opponents in turn order starting after you (phone: their place in the stack). */
  const opponentIndex = (seat: number) =>
    online ? (seat - viewerSeat - 1 + state.players.length) % state.players.length : seat;
  const edgeOf = (seat: number): Edge =>
    online ? edgeFor(seat, viewerSeat, state.players.length) : state.players[seat].edge;
  const actingEdge = edgeOf(acting);
  const rotation = online ? 0 : EDGE_ROTATION[actingEdge];
  const handoff = online ? false : needsHandoff(state, gate);
  const faceSeat = online ? viewerSeat : faceUpHandSeat(state, gate);
  /** True when the person at this screen is the one who must act. */
  const mine = !online || acting === viewerSeat;
  const canAct = !handoff && mine && !offline && state.phase !== 'game-over';
  const handReveal = canAct && prompt?.type === 'view-hand' ? prompt : null;
  const canPlayFromHand = canAct && (!prompt || prompt.type === 'drink-me-extra' || prompt.type === 'setup-pick');
  const selectingCards = canAct && prompt && (MULTI_SELECT.has(prompt.type) || SINGLE_SELECT.has(prompt.type));
  const myTurnNoPrompt = !online && canAct && !prompt;

  const newest = state.log[state.log.length - 1];
  const situation = `${state.round}|${state.log.length}|${newest}|${state.prompts.length}|${prompt?.type}|${acting}`;
  useEffect(() => {
    setSelected([]);
  }, [situation]);
  useEffect(() => {
    setPreview((current) => current?.inspectOnly ? current : null);
  }, [situation, canPlayFromHand]);
  useEffect(() => {
    if (!canPlayFromHand || showRules) endDrag.current?.();
  }, [canPlayFromHand, showRules]);

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

  // nothing playable on your turn: say so, then pass for you (the rulebook's "skip their turn")
  const autoPass = canAct && shouldAutoPass(state, acting);
  useEffect(() => {
    if (!autoPass) return;
    const t = setTimeout(() => send({ type: 'pass', seat: acting }), 2200);
    return () => clearTimeout(t);
  }, [autoPass, acting, situation]); // eslint-disable-line react-hooks/exhaustive-deps

  const overBoard = (x: number, y: number) => {
    const r = document.querySelector('[data-testid="board"]')?.getBoundingClientRect();
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  /** Press on a card in your hand: a click previews it, a drag onto the board plays it. */
  function onCardPointerDown(card: CardT, e: React.PointerEvent) {
    if (e.button !== 0 || !canPlayFromHand || faceSeat !== acting || endDrag.current) return;
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

  const previewCard = preview && faceSeat === preview.seat
    ? state.players[preview.seat].hand.find((c) => c.id === preview.cardId)
    : undefined;
  useEffect(() => {
    if (!previewCard) setPreview(null);
  }, [previewCard]);

  function onOwnCardClick(card: CardT) {
    if (suppressClick.current || handoff || faceSeat === null) return;
    if (selectingCards && MULTI_SELECT.has(prompt.type)) {
      if (!dimmed(card)) setSelected((s) => (s.includes(card.id) ? s.filter((x) => x !== card.id) : [...s, card.id]));
    } else if (selectingCards) {
      if (!dimmed(card)) setSelected((s) => (s[0] === card.id ? [] : [card.id]));
    } else {
      setPreview({ cardId: card.id, seat: faceSeat, inspectOnly: !canPlayFromHand });
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
  const disconnected = online && connected?.[acting] === false;
  const waiting = online && !mine && state.phase !== 'game-over';
  const turnTitle = offline ? 'Reconnecting…'
    : disconnected && waiting ? `Waiting for ${actingPlayer.name} to reconnect…`
    : waiting ? `Waiting for ${actingPlayer.name}`
    : state.phase === 'game-over' ? 'Game complete'
    : state.phase === 'setup' ? (online ? 'Your choice' : `${actingPlayer.name} chooses`)
    : online ? 'Your turn' : `${actingPlayer.name}’s turn`;
  const turnDetail = offline ? null
    : waiting ? (disconnected ? null : prompt && WAITING_FOR[prompt.type] ? `${actingPlayer.name} ${WAITING_FOR[prompt.type]}.` : null)
    : autoPass ? 'No cards you can play. Passing…'
    : canAct && !prompt && online ? (phone ? 'Tap a card to inspect or play it.' : 'Select a card to inspect it, or drag it onto the board.')
    : null;
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
    <Stage
      background={TABLE_IMAGE}
      className={`table-stage${online ? ' table-online' : ' table-hotseat'}`}
      modal={
        showRules ? <RulesPanel onClose={() => setShowRules(false)} returnFocus={rulesButton} />
          : handReveal ? (
            <RevealedHand
              key={`${handReveal.seat}:${handReveal.target}`}
              player={state.players[handReveal.target]}
              rotation={rotation}
              onDone={() => send({ type: 'ack', seat: handReveal.seat })}
            />
          ) : null
      }
    >
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
        revealing={revealing}
        dragging={drag !== null}
      />
      {state.players.map((_, seat) =>
        online && seat !== viewerSeat ? (
          <OpponentPanel
            key={seat}
            state={state}
            seat={seat}
            edge={edgeOf(seat)}
            index={opponentIndex(seat)}
            count={state.players.length - 1}
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
          selectedIds={seat === acting && selectingCards ? selected : undefined}
          isDimmed={canAct && seat === acting ? dimmed : online && seat === viewerSeat ? () => true : undefined}
          onCardClick={faceSeat === seat ? onOwnCardClick : undefined}
          onCardPointerDown={faceSeat === seat && canPlayFromHand ? onCardPointerDown : undefined}
          onCardHover={faceSeat === seat ? setHoverCard : undefined}
          cardSize={online && seat === viewerSeat ? (phone ? 'hand-phone' : 'hand-lg') : 'hand'}
          where={locationLine(state, seat, seat === (online ? viewerSeat : acting))}
          next={state.phase === 'playing' && seat === nextSeatToAct(state) && seat !== state.current}
          controls={controls(seat)}
        />
        ),
      )}

      {!phone ? (
        <aside className="corner corner-tl" aria-label="Table activity">
          <h1 className="table-wordmark"><span>Escape from</span> Wonderland</h1>
          <GameLog lines={state.log} />
        </aside>
      ) : null}
      <aside className="corner corner-tr" aria-label="Table controls">
        <div className="table-toolbar">
          <button className="btn small" ref={rulesButton} onClick={() => setShowRules(true)}>
            Rules
          </button>
          {online ? (
            <button
              className="btn small"
              aria-pressed={sound}
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
        </div>
        <section
          className={`turn-panel${canAct ? ' is-mine' : ''}${offline || disconnected ? ' interrupted' : ''}`}
          role="status"
          data-testid={offline ? 'offline' : autoPass ? 'no-play' : waiting ? 'waiting' : undefined}
        >
          <div className="round-info">{state.phase === 'setup' ? 'Starting cards' : `Round ${state.round}`}</div>
          <div className="turn-heading">{turnTitle}</div>
          {turnDetail ? <div className="turn-detail">{turnDetail}</div> : null}
        </section>
        {phone ? <GameLog lines={state.log} /> : null}
      </aside>

      {canAct && prompt && prompt.type !== 'view-hand' ? (
        (() => {
          const compact = BOARD_PROMPTS.has(prompt.type);
          const pos = phone ? PHONE_PANEL : (compact ? PANEL_POS_EDGE : PANEL_POS)[actingEdge];
          return (
            <div className="prompt-anchor" style={{ left: pos.x, top: pos.y }}>
              <PromptPanel state={state} prompt={prompt} rotation={rotation} selectedIds={selected} send={send} compact={compact} />
            </div>
          );
        })()
      ) : null}

      {myTurnNoPrompt && !gate.peeked && !autoPass ? (
        <div className="prompt-anchor" style={{ left: (phone ? PHONE_PANEL : PANEL_POS[actingEdge]).x, top: (phone ? PHONE_PANEL : PANEL_POS[actingEdge]).y }}>
          <div className="prompt-panel hint" style={{ transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}>
            Click <b>Peek</b> to look at your cards.
          </div>
        </div>
      ) : null}

      {previewCard && !handoff ? (
        (() => {
          const info = canPlayFromHand && !preview?.inspectOnly ? previewInfo(previewCard) : undefined;
          return (
            <CardPreview
              card={previewCard}
              rotation={rotation}
              action={info ? { label: info.label, reason: info.reason, run: () => send(info.action) } : undefined}
              onCancel={() => setPreview(null)}
            />
          );
        })()
      ) : null}

      {hovered && !phone && !previewCard && !showRules ? (
        online ? (
          <div className="hover-preview rail-preview" aria-hidden>
            <Card card={hovered} faceUp size="preview-sm" />
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
      <Animations
        batch={animBatch}
        state={state}
        edgeOf={edgeOf}
        online={online}
        viewerSeat={viewerSeat}
        anchors={anchors}
        opponentIndex={opponentIndex}
        phone={phone}
      />
      {toast ? <div className="toast" role="alert">{toast}</div> : null}
      {handoff ? <HandoffBanner state={state} onConfirm={() => setGate(confirm(state))} /> : null}
    </Stage>
  );
}
