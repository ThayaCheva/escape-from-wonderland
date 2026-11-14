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
    if (parsed?.version === 1 && Array.isArray(parsed.players) && Array.isArray(parsed.prompts)) {
      return parsed as GameState;
    }
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
