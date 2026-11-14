import { useEffect, useState } from 'react';
import type { Card as CardT, Edge, GameAction, GameState, LocationId } from '../../engine/types';
import { actingSeat } from '../../engine/step';
import { checkPlay } from '../../engine/rules';
import { isNumber } from '../../engine/cards';
import { LOCATIONS } from '../../engine/board';
import { BACKGROUND_IMAGE } from '../assets';
import { EDGE_ROTATION, edgeFor } from '../layout';
import { confirm, faceUpHandSeat, needsHandoff, type UiGate } from '../visibility';
import { Board } from './Board';
import { CardPreview } from './CardPreview';
import { GameLog } from './GameLog';
import { HandoffBanner } from './HandoffBanner';
import { PlayerEdge } from './PlayerEdge';
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

export function Table({ state, dispatch, onQuit, viewerSeat, connected, notice }: Props) {
  const [gate, setGate] = useState<UiGate>({ confirmedSeat: null, peeked: false });
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);

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

  const previewCard = preview ? state.players[acting].hand.find((c) => c.id === preview) ?? null : null;

  function onOwnCardClick(card: CardT) {
    if (handoff || faceSeat !== acting) return;
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
          <button className="btn small" onClick={() => send({ type: 'pass', seat })}>
            {actingPlayer.down ? 'Stay down' : 'Pass'}
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
      />
      {state.players.map((_, seat) => (
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
          isDimmed={seat === acting ? dimmed : undefined}
          onCardClick={seat === acting && faceSeat === acting ? onOwnCardClick : undefined}
          controls={controls(seat)}
        />
      ))}

      <div className="corner corner-tl">
        <GameLog lines={state.log} />
      </div>
      <div className="corner corner-tr">
        <button className="btn small" onClick={() => setShowRules(true)}>
          Rules
        </button>
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
      {toast ? <div className="toast">{toast}</div> : null}
      {showRules ? <RulesPanel onClose={() => setShowRules(false)} /> : null}
      {handoff ? <HandoffBanner state={state} onConfirm={() => setGate(confirm(state))} /> : null}
    </Stage>
  );
}
