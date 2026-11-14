// Messages between the browser and the game server (JSON over one WebSocket at /ws).
import type { AliceColor, GameAction, GameState, Seat } from '../engine/types';

export type ClientMsg =
  | { t: 'create'; name: string }
  | { t: 'join'; room: string; name: string }
  | { t: 'resume'; room: string; token: string }
  | { t: 'start' }
  | { t: 'rematch' }
  | { t: 'action'; action: GameAction }
  | { t: 'ping' };

export interface LobbyPlayer {
  name: string;
  alice: AliceColor;
  connected: boolean;
}

export type ServerMsg =
  | { t: 'joined'; room: string; seat: Seat; token: string }
  | { t: 'lobby'; room: string; players: LobbyPlayer[]; hostSeat: Seat; you: Seat }
  | { t: 'view'; view: GameState; seat: Seat; connected: boolean[]; hostSeat: Seat }
  | { t: 'error'; message: string }
  | { t: 'replaced' };

export const ROOM_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const tokenKey = (room: string) => `escape-wonderland/token/${room}`;
