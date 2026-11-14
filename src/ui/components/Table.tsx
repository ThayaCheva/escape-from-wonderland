import type { GameAction, GameState } from '../../engine/types';
import { BACKGROUND_IMAGE } from '../assets';
import { Board } from './Board';
import { PlayerEdge } from './PlayerEdge';
import { Stage } from './Stage';

interface Props {
  state: GameState;
  dispatch: (a: GameAction) => string | null;
  onQuit: () => void;
}

export function Table({ state, onQuit }: Props) {
  return (
    <Stage background={BACKGROUND_IMAGE}>
      <Board state={state} />
      {state.players.map((_, seat) => (
        <PlayerEdge key={seat} state={state} seat={seat} faceUp={false} glowing={state.current === seat} />
      ))}
      <div className="corner corner-tr">
        <button className="btn small" onClick={onQuit}>
          Menu
        </button>
      </div>
    </Stage>
  );
}
