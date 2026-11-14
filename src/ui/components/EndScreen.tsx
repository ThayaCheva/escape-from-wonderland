import type { GameState } from '../../engine/types';
import { BACKGROUND_IMAGE, aliceImage } from '../assets';
import { Stage } from './Stage';

export function EndScreen({ state, onNew, newLabel = 'New game' }: { state: GameState; onNew: () => void; newLabel?: string }) {
  const winner = state.players[state.winner ?? 0];
  return (
    <Stage background={BACKGROUND_IMAGE}>
      <div className="panel end">
        <img className="end-portrait" src={aliceImage(winner.alice)} alt="" />
        <h1>{winner.name} escaped Wonderland!</h1>
        <p>After {state.round} round{state.round === 1 ? '' : 's'}.</p>
        <button className="btn big" onClick={onNew}>
          {newLabel}
        </button>
      </div>
    </Stage>
  );
}
