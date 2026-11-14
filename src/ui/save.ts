import type { GameState } from '../engine/types';

export const SAVE_KEY = 'escape-wonderland/save/v1';

export type SaveStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): SaveStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function saveGame(state: GameState, storage: SaveStorage | null = defaultStorage()): void {
  try {
    storage?.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // storage full or blocked: the game keeps working without saving
  }
}

/** Enough shape checking that rendering a loaded game can't crash on missing pieces. */
function looksLikeGame(g: unknown): boolean {
  if (typeof g !== 'object' || g === null) return false;
  const s = g as Record<string, unknown>;
  const arrays = ['players', 'prompts', 'deck', 'discard', 'pile', 'active', 'log'];
  if (s.version !== 1 || !arrays.every((k) => Array.isArray(s[k]))) return false;
  const players = s.players as Array<Record<string, unknown>>;
  if (players.length < 2 || players.length > 4) return false;
  if (!players.every((p) => p && Array.isArray(p.hand) && typeof p.edge === 'string' && typeof p.position === 'string')) {
    return false;
  }
  const current = s.current;
  return typeof current === 'number' && Number.isInteger(current) && current >= 0 && current < players.length;
}

export function loadGame(storage: SaveStorage | null = defaultStorage()): GameState | null {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(SAVE_KEY) ?? null;
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw);
    if (looksLikeGame(parsed)) return parsed as GameState;
  } catch {
    // fall through to discard
  }
  clearSave(storage);
  return null;
}

export function clearSave(storage: SaveStorage | null = defaultStorage()): void {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
