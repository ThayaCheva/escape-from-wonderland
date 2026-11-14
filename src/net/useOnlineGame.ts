import { useCallback, useEffect, useRef, useState } from 'react';
import { actingSeat } from '../engine/step';
import type { GameAction, GameState, Seat } from '../engine/types';
import { tokenKey, type ClientMsg, type LobbyPlayer, type ServerMsg } from './protocol';

export type OnlineStatus = 'idle' | 'connecting' | 'lobby' | 'game' | 'replaced';

export interface OnlineState {
  status: OnlineStatus;
  room: string | null;
  seat: Seat | null;
  lobby: { players: LobbyPlayer[]; hostSeat: Seat } | null;
  view: GameState | null;
  connected: boolean[];
  /** Latest error from the server, with a counter so repeats still show. */
  error: { message: string; n: number } | null;
}

const IDLE: OnlineState = { status: 'idle', room: null, seat: null, lobby: null, view: null, connected: [], error: null };
const BASE_TITLE = 'Escape from Wonderland';

function socketUrl(): string {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
}

function storedToken(room: string): string | null {
  try {
    return localStorage.getItem(tokenKey(room));
  } catch {
    return null;
  }
}

function storeToken(room: string, token: string | null): void {
  try {
    if (token) localStorage.setItem(tokenKey(room), token);
    else localStorage.removeItem(tokenKey(room));
  } catch {
    // private window: reconnecting just won't survive a reload
  }
}

function setRoomInUrl(room: string | null): void {
  const url = new URL(location.href);
  if (room) url.searchParams.set('room', room);
  else url.searchParams.delete('room');
  history.replaceState(null, '', url);
}

export function roomFromUrl(): string {
  return (new URL(location.href).searchParams.get('room') ?? '').toUpperCase();
}

export function useOnlineGame() {
  const [state, setState] = useState<OnlineState>(IDLE);
  const ws = useRef<WebSocket | null>(null);
  const room = useRef<string | null>(null);
  const pending = useRef<ClientMsg | null>(null);
  const resuming = useRef(false);
  const active = useRef(false);
  const retry = useRef(0);
  const errors = useRef(0);

  const send = useCallback((msg: ClientMsg) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(msg));
  }, []);

  const onMessage = useCallback((msg: ServerMsg) => {
    switch (msg.t) {
      case 'joined':
        room.current = msg.room;
        resuming.current = false;
        storeToken(msg.room, msg.token);
        setRoomInUrl(msg.room);
        setState((s) => ({ ...s, room: msg.room, seat: msg.seat, status: s.status === 'game' ? 'game' : 'lobby' }));
        break;
      case 'lobby':
        setState((s) => ({ ...s, status: 'lobby', room: msg.room, lobby: { players: msg.players, hostSeat: msg.hostSeat } }));
        break;
      case 'view':
        setState((s) => ({ ...s, status: 'game', view: msg.view, seat: msg.seat, connected: msg.connected }));
        break;
      case 'error':
        if (resuming.current) {
          // the seat is gone (e.g. the lobby was left); fall back to joining by code
          resuming.current = false;
          if (room.current) storeToken(room.current, null);
          room.current = null;
          setState({ ...IDLE, error: { message: msg.message, n: ++errors.current } });
          return;
        }
        setState((s) => ({ ...s, error: { message: msg.message, n: ++errors.current } }));
        break;
      case 'replaced':
        active.current = false;
        ws.current?.close();
        setState((s) => ({ ...s, status: 'replaced' }));
        break;
    }
  }, []);

  const connect = useCallback(() => {
    if (ws.current && ws.current.readyState <= WebSocket.OPEN) return;
    const socket = new WebSocket(socketUrl());
    ws.current = socket;
    socket.onopen = () => {
      retry.current = 0;
      const token = room.current ? storedToken(room.current) : null;
      if (room.current && token) {
        resuming.current = true;
        socket.send(JSON.stringify({ t: 'resume', room: room.current, token }));
      } else if (pending.current) {
        socket.send(JSON.stringify(pending.current));
      }
      pending.current = null;
    };
    socket.onmessage = (e) => {
      try {
        onMessage(JSON.parse(String(e.data)));
      } catch {
        // ignore malformed messages
      }
    };
    socket.onclose = () => {
      if (ws.current === socket) ws.current = null;
      if (!active.current) return;
      const delay = Math.min(8000, 1000 * 2 ** retry.current++);
      setTimeout(() => active.current && connect(), delay);
    };
  }, [onMessage]);

  const begin = useCallback(
    (msg: ClientMsg | null) => {
      active.current = true;
      setState((s) => ({ ...s, status: s.status === 'idle' ? 'connecting' : s.status, error: null }));
      if (ws.current?.readyState === WebSocket.OPEN && msg) send(msg);
      else {
        pending.current = msg;
        connect();
      }
    },
    [connect, send],
  );

  const create = useCallback((name: string) => begin({ t: 'create', name }), [begin]);
  const join = useCallback((code: string, name: string) => begin({ t: 'join', room: code.trim().toUpperCase(), name }), [begin]);
  const start = useCallback(() => send({ t: 'start' }), [send]);
  const act = useCallback((action: GameAction) => send({ t: 'action', action }), [send]);

  const leave = useCallback(() => {
    active.current = false;
    if (room.current) storeToken(room.current, null);
    room.current = null;
    ws.current?.close();
    ws.current = null;
    setRoomInUrl(null);
    setState(IDLE);
  }, []);

  // reopening a game link after a refresh puts you back in your seat
  useEffect(() => {
    const code = roomFromUrl();
    if (code && storedToken(code)) {
      room.current = code;
      begin(null);
    }
  }, [begin]);

  // heartbeat keeps the free server awake during a game
  useEffect(() => {
    const t = setInterval(() => send({ t: 'ping' }), 25_000);
    return () => clearInterval(t);
  }, [send]);

  // tell a player who has tabbed out that it's their move
  useEffect(() => {
    const mine = state.status === 'game' && state.view && state.view.phase !== 'game-over' && actingSeat(state.view) === state.seat;
    document.title = mine ? `Your turn — ${BASE_TITLE}` : BASE_TITLE;
  }, [state]);

  return { ...state, create, join, start, act, leave };
}
