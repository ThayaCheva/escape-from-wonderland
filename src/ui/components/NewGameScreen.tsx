import { useState } from 'react';
import { BACKGROUND_IMAGE, aliceImage } from '../assets';
import type { AliceColor } from '../../engine/types';
import type { StartOptions } from '../useGame';
import { Stage } from './Stage';

const SEATS: Record<3 | 4, Array<{ alice: AliceColor; label: string; where: string }>> = {
  4: [
    { alice: 'gold', label: 'Gold Alice', where: 'bottom' },
    { alice: 'rose', label: 'Rose Alice', where: 'left' },
    { alice: 'blue', label: 'Blue Alice', where: 'top' },
    { alice: 'mint', label: 'Mint Alice', where: 'right' },
  ],
  3: [
    { alice: 'gold', label: 'Gold Alice', where: 'bottom' },
    { alice: 'rose', label: 'Rose Alice', where: 'left' },
    { alice: 'mint', label: 'Mint Alice', where: 'right' },
  ],
};

export function NewGameScreen({ onStart, onBack }: { onStart: (o: StartOptions) => void; onBack: () => void }) {
  const [count, setCount] = useState<3 | 4>(4);
  const [names, setNames] = useState<Record<AliceColor, string>>({ gold: '', rose: '', blue: '', mint: '' });
  const seats = SEATS[count];
  return (
    <Stage background={BACKGROUND_IMAGE}>
      <div className="panel newgame">
        <h1>New game</h1>
        <div className="count-choice">
          {([3, 4] as const).map((n) => (
            <button key={n} className={`btn${count === n ? ' active' : ''}`} onClick={() => setCount(n)}>
              {n} players
            </button>
          ))}
        </div>
        <div className="seat-list">
          {seats.map((s) => (
            <label key={s.alice} className="seat-row">
              <img src={aliceImage(s.alice)} alt="" />
              <span className="seat-where">Sits at the {s.where}</span>
              <input
                placeholder={s.label}
                maxLength={16}
                value={names[s.alice]}
                onChange={(e) => setNames({ ...names, [s.alice]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <div className="row">
          <button className="btn" onClick={onBack}>
            Back
          </button>
          <button className="btn big" onClick={() => onStart({ playerCount: count, names: seats.map((s) => names[s.alice]) })}>
            Start
          </button>
        </div>
      </div>
    </Stage>
  );
}
