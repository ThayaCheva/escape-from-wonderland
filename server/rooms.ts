// Rooms, seats and the authoritative game state for each room. No networking here.
import { newGame, seatAlices, ALICE_NAMES } from '../src/engine/setup';
import { buildDeck } from '../src/engine/cards';
import { IllegalActionError, step } from '../src/engine/step';
import { viewFor } from '../src/engine/view';
import { ROOM_LETTERS, type ClientMsg, type ServerMsg } from '../src/net/protocol';
import type { GameAction, GameState, Seat } from '../src/engine/types';

export interface Conn {
  id: string;
  send(msg: ServerMsg): void;
}

interface SeatInfo {
  /** '' means "use the Alice name". */
  name: string;
  token: string;
  conn: Conn | null;
}

interface Room {
  code: string;
  phase: 'lobby' | 'game';
  seats: SeatInfo[];
  hostSeat: Seat;
  game: GameState | null;
  emptySince: number | null;
  endedAt: number | null;
}

const ABANDONED_MS = 30 * 60_000;
const ENDED_MS = 10 * 60_000;
const MAX_NAME = 16;
const TOKEN_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

export class RoomManager {
  private rooms = new Map<string, Room>();
  private byConn = new Map<string, { code: string; seat: Seat }>();

  constructor(private opts: { now: () => number; randomInt: (max: number) => number }) {}

  roomCount(): number {
    return this.rooms.size;
  }

  handle(conn: Conn, msg: ClientMsg): void {
    switch (msg?.t) {
      case 'create':
        return this.create(conn, msg.name);
      case 'join':
        return this.join(conn, msg.room, msg.name);
      case 'resume':
        return this.resume(conn, msg.room, msg.token);
      case 'start':
        return this.start(conn);
      case 'rematch':
        return this.rematch(conn);
      case 'action':
        return this.action(conn, msg.action);
      default:
        return;
    }
  }

  disconnect(conn: Conn): void {
    const at = this.byConn.get(conn.id);
    if (!at) return;
    this.byConn.delete(conn.id);
    const room = this.rooms.get(at.code);
    if (!room) return;
    if (room.phase === 'lobby') {
      room.seats.splice(at.seat, 1);
      if (room.seats.length === 0) {
        this.rooms.delete(room.code);
        return;
      }
      if (room.hostSeat === at.seat) room.hostSeat = 0;
      else if (room.hostSeat > at.seat) room.hostSeat--;
      this.reindex(room);
      this.broadcastLobby(room);
      return;
    }
    room.seats[at.seat].conn = null;
    if (room.seats.every((s) => s.conn === null)) room.emptySince = this.opts.now();
    this.broadcastViews(room);
  }

  sweep(): void {
    const now = this.opts.now();
    for (const room of [...this.rooms.values()]) {
      const abandoned = room.emptySince !== null && now - room.emptySince >= ABANDONED_MS;
      const ended = room.endedAt !== null && now - room.endedAt >= ENDED_MS;
      if (abandoned || ended) {
        for (const s of room.seats) if (s.conn) this.byConn.delete(s.conn.id);
        this.rooms.delete(room.code);
      }
    }
  }

  // ---------- handlers ----------

  private create(conn: Conn, name: string): void {
    this.detach(conn);
    let code = '';
    do {
      code = Array.from({ length: 4 }, () => ROOM_LETTERS[this.opts.randomInt(ROOM_LETTERS.length)]).join('');
    } while (this.rooms.has(code));
    const room: Room = { code, phase: 'lobby', seats: [], hostSeat: 0, game: null, emptySince: null, endedAt: null };
    this.rooms.set(code, room);
    this.seat(conn, room, name);
  }

  private join(conn: Conn, rawCode: string, name: string): void {
    const room = this.rooms.get(String(rawCode ?? '').trim().toUpperCase());
    if (!room) return conn.send({ t: 'error', message: 'No room with that code.' });
    if (room.phase !== 'lobby') return conn.send({ t: 'error', message: 'That game has already started.' });
    if (room.seats.length >= 4) return conn.send({ t: 'error', message: 'That room is full.' });
    this.detach(conn);
    this.seat(conn, room, name);
  }

  private resume(conn: Conn, rawCode: string, token: string): void {
    const room = this.rooms.get(String(rawCode ?? '').trim().toUpperCase());
    const seat = room ? room.seats.findIndex((s) => s.token === token) : -1;
    if (!room || seat < 0) return conn.send({ t: 'error', message: "Couldn't rejoin that room." });
    this.detach(conn);
    const old = room.seats[seat].conn;
    if (old && old.id !== conn.id) {
      this.byConn.delete(old.id);
      old.send({ t: 'replaced' });
    }
    room.seats[seat].conn = conn;
    room.emptySince = null;
    this.byConn.set(conn.id, { code: room.code, seat });
    conn.send({ t: 'joined', room: room.code, seat, token });
    if (room.phase === 'lobby') this.broadcastLobby(room);
    else this.broadcastViews(room);
  }

  private start(conn: Conn): void {
    const at = this.byConn.get(conn.id);
    const room = at ? this.rooms.get(at.code) : undefined;
    if (!at || !room || room.phase !== 'lobby' || room.hostSeat !== at.seat) return;
    const count = room.seats.length;
    if (count < 2) return conn.send({ t: 'error', message: 'Need at least 2 players.' });
    room.phase = 'game';
    this.deal(room);
  }

  /** After a game ends, the host deals a fresh game for the same seats. */
  private rematch(conn: Conn): void {
    const at = this.byConn.get(conn.id);
    const room = at ? this.rooms.get(at.code) : undefined;
    if (!at || !room || room.hostSeat !== at.seat || room.game?.phase !== 'game-over') return;
    room.endedAt = null;
    this.deal(room);
  }

  private deal(room: Room): void {
    const count = room.seats.length;
    room.game = newGame({
      playerCount: count as 2 | 3 | 4,
      names: room.seats.map((s) => s.name),
      seed: this.opts.randomInt(2 ** 32),
      // the opening deal uses the server's secure randomness, not the engine's guessable 32-bit seed
      deck: this.shuffle(buildDeck()),
    });
    this.broadcastViews(room);
  }

  private action(conn: Conn, action: GameAction): void {
    const at = this.byConn.get(conn.id);
    const room = at ? this.rooms.get(at.code) : undefined;
    if (!at || !room || !room.game || !action || action.seat !== at.seat) return;
    // a fresh secret seed before every move, so later engine shuffles can't be predicted
    room.game.seed = this.opts.randomInt(2 ** 32);
    try {
      room.game = step(room.game, action);
    } catch (e) {
      if (e instanceof IllegalActionError) return conn.send({ t: 'error', message: e.message });
      throw e;
    }
    if (room.game.phase === 'game-over' && room.endedAt === null) room.endedAt = this.opts.now();
    this.broadcastViews(room);
  }

  // ---------- helpers ----------

  private seat(conn: Conn, room: Room, rawName: string): void {
    const name = String(rawName ?? '').trim().slice(0, MAX_NAME);
    const token = Array.from({ length: 24 }, () => TOKEN_CHARS[this.opts.randomInt(TOKEN_CHARS.length)]).join('');
    room.seats.push({ name, token, conn });
    const seat = room.seats.length - 1;
    this.byConn.set(conn.id, { code: room.code, seat });
    conn.send({ t: 'joined', room: room.code, seat, token });
    this.broadcastLobby(room);
  }

  /** Fisher–Yates with the injected (secure) random source. */
  private shuffle<T>(items: T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.opts.randomInt(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /** A connection that is already seated somewhere leaves that seat first. */
  private detach(conn: Conn): void {
    if (this.byConn.has(conn.id)) this.disconnect(conn);
  }

  private reindex(room: Room): void {
    room.seats.forEach((s, i) => {
      if (s.conn) this.byConn.set(s.conn.id, { code: room.code, seat: i });
    });
  }

  private broadcastLobby(room: Room): void {
    const count = Math.min(4, Math.max(2, room.seats.length)) as 2 | 3 | 4;
    const alices = seatAlices(count);
    const players = room.seats.map((s, i) => {
      const alice = alices[i] ?? 'gold';
      return { name: s.name || ALICE_NAMES[alice], alice, connected: s.conn !== null };
    });
    room.seats.forEach((s, you) => s.conn?.send({ t: 'lobby', room: room.code, players, hostSeat: room.hostSeat, you }));
  }

  private broadcastViews(room: Room): void {
    const game = room.game;
    if (!game) return;
    const connected = room.seats.map((s) => s.conn !== null);
    room.seats.forEach((s, seat) => {
      s.conn?.send({ t: 'view', view: viewFor(game, seat), seat, connected, hostSeat: room.hostSeat });
    });
  }
}
