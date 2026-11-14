import { TITLE_IMAGE } from '../assets';
import { Stage } from './Stage';

export function TitleScreen({ canContinue, onNew, onContinue }: { canContinue: boolean; onNew: () => void; onContinue: () => void }) {
  return (
    <Stage background={TITLE_IMAGE}>
      <div className="title-buttons">
        <button className="btn big" onClick={onNew}>
          New game
        </button>
        {canContinue ? (
          <button className="btn big" onClick={onContinue}>
            Continue game
          </button>
        ) : null}
      </div>
    </Stage>
  );
}
