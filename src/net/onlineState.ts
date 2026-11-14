// Small pure rules for the online connection state (kept out of the React hook so they can be tested).

export type OnlineStatus = 'idle' | 'connecting' | 'lobby' | 'game' | 'replaced';

/** A server error (wrong code, room full…) while connecting should unlock the entry form. */
export function statusAfterError(status: OnlineStatus): OnlineStatus {
  return status === 'connecting' ? 'idle' : status;
}

/**
 * Whether leaving should forget this browser's seat token.
 * Keep it during a running game (reopening the link resumes the seat) and in a tab that was
 * replaced (the token belongs to the tab that took over).
 */
export function forgetSeatOnLeave(status: OnlineStatus, gameOver: boolean): boolean {
  if (status === 'replaced') return false;
  if (status === 'game' && !gameOver) return false;
  return true;
}
