import { useState } from 'react';
import type { LobbyPlayer } from '../../net/protocol';
import { BACKGROUND_IMAGE, aliceImage } from '../assets';
import { Stage } from './Stage';

interface Props {
  room: string;
  seat: number;
  players: LobbyPlayer[];
  hostSeat: number;
  error: string | null;
  onStart: () => void;
  onLeave: () => void;
}

export function LobbyScreen({ room, seat, players, hostSeat, error, onStart, onLeave }: Props) {
  const [copied, setCopied] = useState(false);
  const isHost = seat === hostSeat;
  const link = `${location.origin}/?room=${room}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Stage background={BACKGROUND_IMAGE}>
      <div className="panel lobby">
        <h1>Room</h1>
        <div className="room-code" data-testid="room-code">
          {room}
        </div>
        <div className="row">
          <button className="btn" onClick={copy}>
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
        <p className="muted">Send the code or link to your friends.</p>
        <div className="seat-list">
          {players.map((p, i) => (
            <div key={i} className="seat-row">
              <img src={aliceImage(p.alice)} alt="" />
              <span className="lobby-name">
                {p.name}
                {i === seat ? ' (you)' : ''}
                {i === hostSeat ? ' — host' : ''}
              </span>
            </div>
          ))}
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="row">
          <button className="btn" onClick={onLeave}>
            Leave
          </button>
          {isHost ? (
            <button className="btn big" disabled={players.length < 2} onClick={onStart}>
              Start game
            </button>
          ) : (
            <p className="muted">Waiting for the host to start…</p>
          )}
        </div>
        {isHost && players.length < 2 ? <p className="muted">You need at least 2 players (up to 4).</p> : null}
      </div>
    </Stage>
  );
}
