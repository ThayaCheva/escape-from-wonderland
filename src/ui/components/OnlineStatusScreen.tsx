import { BACKGROUND_IMAGE } from '../assets';
import { Stage } from './Stage';

export function OnlineStatusScreen({ title, detail, onBack }: { title: string; detail: string; onBack: () => void }) {
  return (
    <Stage background={BACKGROUND_IMAGE}>
      <div className="panel">
        <h1>{title}</h1>
        <p>{detail}</p>
        <button className="btn" onClick={onBack}>
          Back to the title screen
        </button>
      </div>
    </Stage>
  );
}
