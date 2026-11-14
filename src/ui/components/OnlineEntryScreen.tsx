import { useState } from 'react';
import { BACKGROUND_IMAGE } from '../assets';
import { Stage } from './Stage';

interface Props {
  mode: 'create' | 'join';
  initialCode: string;
  error: string | null;
  busy: boolean;
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
  onBack: () => void;
}

export function OnlineEntryScreen({ mode, initialCode, error, busy, onCreate, onJoin, onBack }: Props) {
  const [name, setName] = useState('');
  const [code, setCode] = useState(initialCode);
  const canGo = mode === 'create' || code.trim().length === 4;
  const go = () => (mode === 'create' ? onCreate(name) : onJoin(code, name));
  return (
    <Stage background={BACKGROUND_IMAGE}>
      <div className="panel online-entry">
        <h1>{mode === 'create' ? 'Create a room' : 'Join a room'}</h1>
        <label className="field">
          <span>Your name</span>
          <input autoFocus maxLength={16} value={name} placeholder="Alice" onChange={(e) => setName(e.target.value)} />
        </label>
        {mode === 'join' ? (
          <label className="field">
            <span>Room code</span>
            <input
              className="code-input"
              maxLength={4}
              value={code}
              placeholder="ABCD"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && canGo && go()}
            />
          </label>
        ) : null}
        {error ? <p className="form-error">{error}</p> : null}
        {busy ? <p className="muted">Connecting… if the server was asleep this can take up to a minute.</p> : null}
        <div className="row">
          <button className="btn" onClick={onBack}>
            Back
          </button>
          <button className="btn big" disabled={!canGo || busy} onClick={go}>
            {mode === 'create' ? 'Create' : 'Join'}
          </button>
        </div>
      </div>
    </Stage>
  );
}
