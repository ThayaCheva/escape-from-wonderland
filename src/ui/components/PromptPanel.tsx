import type { GameAction, GameState, NumberCard, Prompt } from '../../engine/types';
import { isNumber } from '../../engine/cards';
import { Card } from './Card';

interface Props {
  state: GameState;
  prompt: Prompt;
  rotation: number;
  selectedIds: string[];
  send: (a: GameAction) => void;
  compact?: boolean;
}

function selectionSum(state: GameState, seat: number, ids: string[]): number {
  return state.players[seat].hand
    .filter((c): c is NumberCard => ids.includes(c.id) && isNumber(c))
    .reduce((t, c) => t + c.value, 0);
}

export function PromptPanel({ state, prompt, rotation, selectedIds, send, compact }: Props) {
  const seat = prompt.seat;
  const name = (s: number) => state.players[s].name;
  const hand = state.players[seat].hand;
  let body: React.ReactNode = null;

  switch (prompt.type) {
    case 'setup-pick': {
      const hasNumber = hand.some(isNumber);
      body = hasNumber ? (
        <p>Click a number card in your hand to choose it as your starting card.</p>
      ) : (
        <>
          <p>You have no number card.</p>
          <button className="btn" onClick={() => send({ type: 'setup-pick', seat, cardId: null })}>
            Continue without one
          </button>
        </>
      );
      break;
    }
    case 'drink-me-extra':
      body = (
        <>
          <p>
            Drink Me: play up to {prompt.remaining} more card{prompt.remaining === 1 ? '' : 's'}. Number cards ignore value
            and colour.
          </p>
          <button className="btn" onClick={() => send({ type: 'done', seat })}>
            Done
          </button>
        </>
      );
      break;
    case 'eat-me': {
      const sum = selectionSum(state, seat, selectedIds);
      body = (
        <>
          <p>Eat Me: choose number cards adding up to 5 or less. Selected: {sum}</p>
          <button className="btn" disabled={sum > 5} onClick={() => send({ type: 'choose-cards', seat, cardIds: selectedIds })}>
            Discard {selectedIds.length} card{selectedIds.length === 1 ? '' : 's'}
          </button>
        </>
      );
      break;
    }
    case 'discard': {
      const min = Math.min(prompt.min, hand.length);
      const ok = selectedIds.length >= min && selectedIds.length <= prompt.max;
      body = (
        <>
          <p>{prompt.reason}</p>
          <p className="muted">
            {min === prompt.max ? `Choose ${min}.` : `Choose up to ${prompt.max}.`} Selected: {selectedIds.length}
          </p>
          <button className="btn" disabled={!ok} onClick={() => send({ type: 'choose-cards', seat, cardIds: selectedIds })}>
            Confirm
          </button>
        </>
      );
      break;
    }
    case 'vorpal-target':
      body = <p>Vorpal Sword: click an active card on the board to slay it.</p>;
      break;
    case 'execution-declare':
      body = (
        <>
          <p>Execution Order: declare a number.</p>
          <div className="value-grid">
            {Array.from({ length: 13 }, (_, i) => i + 1).map((v) => (
              <button key={v} className="btn" onClick={() => send({ type: 'choose-value', seat, value: v })}>
                {v}
              </button>
            ))}
          </div>
        </>
      );
      break;
    case 'execution-choose':
      body = (
        <>
          <p>
            {name(prompt.bySeat)} declared {prompt.value}. You hold more than one — choose which to play.
          </p>
          <button className="btn" disabled={selectedIds.length !== 1} onClick={() => send({ type: 'choose-cards', seat, cardIds: selectedIds })}>
            Play it
          </button>
        </>
      );
      break;
    case 'choose-player': {
      const what = { caterpillar: 'Wisdom of Caterpillar', exile: 'Exile', vines: 'Vines' }[prompt.purpose];
      body = <p>{what}: click a highlighted player.</p>;
      break;
    }
    case 'view-hand': {
      const target = state.players[prompt.target];
      body = (
        <>
          <p>{target.name}’s hand:</p>
          <div className="panel-hand">
            {target.hand.map((c) => (
              <Card key={c.id} card={c} faceUp size="hand" />
            ))}
          </div>
          <button className="btn" onClick={() => send({ type: 'ack', seat })}>
            OK
          </button>
        </>
      );
      break;
    }
    case 'exile-location':
      body = <p>Exile: click a location on the board to move {name(prompt.target)} there.</p>;
      break;
    case 'vines-take': {
      const target = state.players[prompt.target];
      body = (
        <>
          <p>Vines: take one of {target.name}’s cards.</p>
          <div className="panel-hand">
            {target.hand.map((c, i) => (
              <Card key={c.id} card={null} faceUp={false} size="hand" onClick={() => send({ type: 'choose-hand-index', seat, index: i })} />
            ))}
          </div>
        </>
      );
      break;
    }
    case 'vines-give':
      body = (
        <>
          <p>Vines: choose a card from your hand to give to {name(prompt.target)}.</p>
          <button className="btn" disabled={selectedIds.length !== 1} onClick={() => send({ type: 'choose-cards', seat, cardIds: selectedIds })}>
            Give it
          </button>
        </>
      );
      break;
    case 'round-end-move':
      body = (
        <>
          <p>The round is over. You played the last number card: click a location to move there, or stay.</p>
          <button className="btn" onClick={() => send({ type: 'choose-location', seat, location: null })}>
            Stay here
          </button>
        </>
      );
      break;
  }

  return (
    <div className={`prompt-panel${compact ? ' compact' : ''}`} style={{ transform: `translate(-50%, -50%) rotate(${rotation}deg)` }} data-testid="prompt">
      <div className="prompt-who">{name(seat)}</div>
      {body}
    </div>
  );
}
