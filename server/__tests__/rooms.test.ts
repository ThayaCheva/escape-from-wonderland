import { beforeEach, describe, expect, it } from 'vitest';
import { RoomManager, type Conn } from '../rooms';
import type { ServerMsg } from '../../src/net/protocol';
import { isNumber } from '../../src/engine/cards';

let clock = 0;
let manager: RoomManager;
let nextId = 0;

interface FakeConn extends Conn {
  msgs: ServerMsg[];
  last<T extends ServerMsg['t']>(t: T): Extract<ServerMsg, { t: T }> | undefined;
}

function conn(): FakeConn {
  const msgs: ServerMsg[] = [];
  return {
    id: `c${nextId++}`,
    msgs,
    send: (m) => msgs.push(m),
    last: (t) => [...msgs].reverse().find((m) => m.t === t) as never,
  };
}

function createRoom(name = 'Ann') {
  const host = conn();
  manager.handle(host, { t: 'create', name });
  const room = host.last('joined')!.room;
  return { host, room };
}

/** Lobby with n players; returns conns in seat order. */
function lobby(n: number) {
  const { host, room } = createRoom();
  const conns = [host];
  for (let i = 1; i < n; i++) {
    const c = conn();
    manager.handle(c, { t: 'join', room, name: `P${i}` });
    conns.push(c);
  }
  return { room, conns };
}

beforeEach(() => {
  clock = 0;
  let r = 0;
  manager = new RoomManager({ now: () => clock, randomInt: (max) => (r = (r * 7 + 13) % max) });
});

describe('lobby', () => {
  it('create seats the creator and reports the lobby', () => {
    const { host, room } = createRoom();
    expect(room).toMatch(/^[A-HJ-NP-Z]{4}$/);
    expect(host.last('joined')).toMatchObject({ seat: 0 });
    expect(host.last('lobby')!.players).toHaveLength(1);
  });

  it('join errors: unknown room, full room, started game', () => {
    const stranger = conn();
    manager.handle(stranger, { t: 'join', room: 'ZZZZ', name: 'X' });
    expect(stranger.last('error')!.message).toBe('No room with that code.');

    const { room, conns } = lobby(4);
    const fifth = conn();
    manager.handle(fifth, { t: 'join', room, name: 'E' });
    expect(fifth.last('error')!.message).toBe('That room is full.');

    const two = lobby(2);
    manager.handle(two.conns[0], { t: 'start' });
    const late = conn();
    manager.handle(late, { t: 'join', room: two.room, name: 'L' });
    expect(late.last('error')!.message).toBe('That game has already started.');
    expect(conns).toHaveLength(4);
  });

  it('names are trimmed and capped, and blank names get the Alice name', () => {
    const { room, conns } = lobby(1);
    const c = conn();
    manager.handle(c, { t: 'join', room, name: '   ' });
    const d = conn();
    manager.handle(d, { t: 'join', room, name: 'A very very long player name' });
    const names = d.last('lobby')!.players.map((p) => p.name);
    expect(names[1]).toBe('Rose Alice');
    expect(names[2]).toHaveLength(16);
    expect(conns).toHaveLength(1);
  });

  it('only the host can start, and not alone', () => {
    const solo = createRoom();
    manager.handle(solo.host, { t: 'start' });
    expect(solo.host.last('error')!.message).toBe('Need at least 2 players.');

    const { conns } = lobby(2);
    manager.handle(conns[1], { t: 'start' });
    expect(conns[1].last('view')).toBeUndefined();
    manager.handle(conns[0], { t: 'start' });
    const v0 = conns[0].last('view')!;
    const v1 = conns[1].last('view')!;
    expect(v0.seat).toBe(0);
    expect(v1.seat).toBe(1);
    const json1 = JSON.stringify(v1.view);
    for (const c of v0.view.players[0].hand) expect(json1).not.toContain(`"${c.id}"`);
  });

  it('when the host leaves the lobby the next player becomes host; an empty lobby is deleted', () => {
    const { conns } = lobby(3);
    manager.disconnect(conns[0]);
    const l = conns[1].last('lobby')!;
    expect(l.players.map((p) => p.name)).toEqual(['P1', 'P2']);
    expect(l.hostSeat).toBe(0);
    manager.disconnect(conns[1]);
    manager.disconnect(conns[2]);
    expect(manager.roomCount()).toBe(0);
  });
});

describe('game', () => {
  function started(n = 3) {
    const l = lobby(n);
    manager.handle(l.conns[0], { t: 'start' });
    return l;
  }

  it('setup picks flow through, actions for other seats are ignored', () => {
    const { conns } = started(3);
    const before = conns[1].msgs.length;
    manager.handle(conns[1], { t: 'action', action: { type: 'pass', seat: 0 } });
    expect(conns[1].msgs.length).toBe(before);
  });

  it('an illegal action errors to the sender only; a legal one updates everyone', () => {
    const { conns } = started(3);
    const view0 = conns[0].last('view')!.view;
    manager.handle(conns[0], { t: 'action', action: { type: 'pass', seat: 0 } });
    expect(conns[0].last('error')!.message).toBe('Choose your starting card.');
    const n1 = conns[1].msgs.length;
    const pick = view0.players[0].hand.find(isNumber)!;
    manager.handle(conns[0], { t: 'action', action: { type: 'setup-pick', seat: 0, cardId: pick.id } });
    expect(conns[1].msgs.length).toBe(n1 + 1);
    expect(conns[1].last('view')!.view.prompts[0]).toEqual({ type: 'setup-pick', seat: 1 });
  });

  it('resume with the token takes the seat back and the old connection is replaced', () => {
    const { room, conns } = started(3);
    const token = conns[1].last('joined')!.token;
    const fresh = conn();
    manager.handle(fresh, { t: 'resume', room, token });
    expect(conns[1].last('replaced')).toBeDefined();
    expect(fresh.last('view')!.seat).toBe(1);
    // the replaced connection can no longer act
    const n = fresh.msgs.length;
    manager.handle(conns[1], { t: 'action', action: { type: 'pass', seat: 1 } });
    expect(fresh.msgs.length).toBe(n);
  });

  it('a wrong token is rejected', () => {
    const { room } = started(2);
    const c = conn();
    manager.handle(c, { t: 'resume', room, token: 'nope' });
    expect(c.last('error')!.message).toBe("Couldn't rejoin that room.");
  });

  it('a disconnect mid-game is shown to the others', () => {
    const { conns } = started(3);
    manager.disconnect(conns[2]);
    expect(conns[0].last('view')!.connected).toEqual([true, true, false]);
  });

  it('an abandoned game is swept after 30 minutes, not before', () => {
    const { conns } = started(2);
    conns.forEach((c) => manager.disconnect(c));
    clock += 29 * 60_000;
    manager.sweep();
    expect(manager.roomCount()).toBe(1);
    clock += 2 * 60_000;
    manager.sweep();
    expect(manager.roomCount()).toBe(0);
  });
});

describe('review fixes', () => {
  it('after the host leaves, every lobby message tells each player their own new seat', () => {
    const { conns } = lobby(3);
    manager.disconnect(conns[0]);
    const l1 = conns[1].last('lobby')!;
    const l2 = conns[2].last('lobby')!;
    expect(l1.you).toBe(0);
    expect(l2.you).toBe(1);
    expect(l1.hostSeat).toBe(0);
    // the new host can actually start
    manager.handle(conns[1], { t: 'start' });
    expect(conns[1].last('view')).toBeDefined();
  });

  it('the opening deal comes from the injected random source, not the 32-bit game seed', () => {
    const deal = (seq: number[]) => {
      let i = 0;
      const m = new RoomManager({ now: () => 0, randomInt: (max) => seq[i++ % seq.length] % max });
      const a = conn();
      m.handle(a, { t: 'create', name: 'A' });
      const b = conn();
      m.handle(b, { t: 'join', room: a.last('joined')!.room, name: 'B' });
      m.handle(a, { t: 'start' });
      return a.last('view')!.view.players[0].hand.map((c) => c.id).join(',');
    };
    expect(deal([1, 2, 3, 4, 5, 6, 7])).not.toBe(deal([7, 6, 5, 4, 3, 2, 1]));
  });
});

describe('rematch', () => {
  function finished() {
    const l = lobby(2);
    manager.handle(l.conns[0], { t: 'start' });
    // hand-built: end the game in the room's state
    const room = (manager as unknown as { rooms: Map<string, { game: { phase: string; winner: number } }> }).rooms.get(l.room)!;
    return { ...l, room };
  }

  it('is ignored from a guest and in the middle of a game', () => {
    const { conns } = finished();
    const n = conns[0].msgs.length;
    manager.handle(conns[0], { t: 'rematch' });
    expect(conns[0].msgs.length).toBe(n);
  });

  it('after game over, the host starts a fresh game with the same seats', () => {
    const { conns, room } = finished();
    room.game.phase = 'game-over';
    room.game.winner = 1;
    const before = conns[1].msgs.length;
    manager.handle(conns[1], { t: 'rematch' });
    expect(conns[1].msgs.length).toBe(before);
    manager.handle(conns[0], { t: 'rematch' });
    const v = conns[1].last('view')!.view;
    expect(v.phase).toBe('setup');
    expect(v.players.map((p) => p.name)).toEqual(['Ann', 'P1']);
    expect(v.prompts[0]).toEqual({ type: 'setup-pick', seat: 0 });
  });
});

describe('host in game views', () => {
  it('every view says who the host is, so a reloaded host still gets Play again', () => {
    const { conns } = lobby(2);
    manager.handle(conns[0], { t: 'start' });
    expect(conns[1].last('view')!.hostSeat).toBe(0);
  });
});

describe('ended rooms', () => {
  it('a finished room with players still connected is kept, so Play again works later', () => {
    const { conns } = lobby(2);
    manager.handle(conns[0], { t: 'start' });
    const rooms = (manager as unknown as { rooms: Map<string, { game: { phase: string }; endedAt: number | null }> }).rooms;
    const room = [...rooms.values()][0];
    room.game.phase = 'game-over';
    room.endedAt = clock;
    clock += 11 * 60_000;
    manager.sweep();
    const before = conns[1].msgs.length;
    manager.handle(conns[0], { t: 'rematch' });
    expect(conns[1].msgs.length).toBe(before + 1);
    expect(conns[1].last('view')!.view.phase).toBe('setup');
  });

  it('Play again in a room that has closed says so instead of doing nothing', () => {
    const { conns } = lobby(2);
    manager.handle(conns[0], { t: 'start' });
    const rooms = (manager as unknown as { rooms: Map<string, unknown> }).rooms;
    rooms.clear();
    manager.handle(conns[0], { t: 'rematch' });
    expect(conns[0].last('error')!.message).toBe('This room has closed. Create a new room to play again.');
  });
});
