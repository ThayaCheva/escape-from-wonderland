import { TITLE_IMAGE } from '../assets';
import { Stage } from './Stage';

interface Props {
  canContinue: boolean;
  onCreate: () => void;
  onJoin: () => void;
  onLocal: () => void;
  onContinue: () => void;
}

export function TitleScreen({ canContinue, onCreate, onJoin, onLocal, onContinue }: Props) {
  return (
    <Stage background={TITLE_IMAGE}>
      <div className="title-buttons">
        <button className="btn big" onClick={onCreate}>
          Create online room
        </button>
        <button className="btn big" onClick={onJoin}>
          Join room
        </button>
      </div>
      <div className="title-buttons secondary">
        <button className="btn" onClick={onLocal}>
          Play on one screen
        </button>
        {canContinue ? (
          <button className="btn" onClick={onContinue}>
            Continue one-screen game
          </button>
        ) : null}
      </div>
    </Stage>
  );
}
