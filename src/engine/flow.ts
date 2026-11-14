import { drawAndLog, drawCards, log, nameOf } from './mutate';
import { isImmune, nextSeat } from './rules';
import type { GameState, Prompt, Seat } from './types';

export function startTurn(s: GameState, seat: Seat): void {
  s.current = seat;
  s.turnActionTaken = false;
  s.effectCauser = null;
  const player = s.players[seat];
  if (player.skipNextTurn) {
    player.skipNextTurn = false;
    log(s, `${player.name}'s turn is skipped.`);
    advanceTurn(s);
    return;
  }
  if (player.drinkMeLock === 'pending') player.drinkMeLock = 'active';
  for (const j of s.active.filter((a) => a.card.name === 'jabberwocky')) {
    if (!isImmune(s, seat, { kind: 'event', bySeat: j.seat })) {
      const drawn = drawCards(s, seat, 1);
      if (drawn) log(s, `The Jabberwocky makes ${player.name} draw a card.`);
    }
  }
}

export function advanceTurn(s: GameState): void {
  const player = s.players[s.current];
  if (player.drinkMeLock === 'active') player.drinkMeLock = 'none';
  startTurn(s, nextSeat(s, s.current));
}

export function checkWin(s: GameState): boolean {
  const n = s.players.length;
  const from = s.effectCauser ?? s.current;
  for (let i = 0; i < n; i++) {
    const seat = (from + i) % n;
    if (s.players[seat].hand.length === 0) {
      s.winner = seat;
      s.phase = 'game-over';
      s.prompts = [];
      log(s, `${nameOf(s, seat)} escapes Wonderland!`);
      return true;
    }
  }
  return false;
}

export function endRound(s: GameState): void {
  const starter = s.roundEnding!.starter;
  s.discard.push(...s.pile.map((e) => e.card), ...s.active.map((a) => a.card));
  s.pile = [];
  s.active = [];
  s.cheshireUsedThisRound = false;
  s.lastNumberSeat = null;
  s.roundEnding = null;
  for (const p of s.players) p.down = false;
  s.round++;
  log(s, `Round ${s.round} begins. Everyone draws a card.`);
  for (let i = 0; i < s.players.length; i++) drawAndLog(s, (starter + i) % s.players.length, 1);
  // the previous player's Drink Me lock (if it was this turn) ends with the round's last turn
  const prev = s.players[s.current];
  if (prev.drinkMeLock === 'active') prev.drinkMeLock = 'none';
  startTurn(s, starter);
}

function isEmptyPrompt(s: GameState, p: Prompt): boolean {
  const hand = s.players[p.seat].hand;
  switch (p.type) {
    case 'discard':
    case 'drink-me-extra':
      return hand.length === 0;
    case 'eat-me':
      return !hand.some((c) => c.kind === 'number' && c.value <= 5);
    default:
      return false;
  }
}

/** Runs after every action: drops impossible prompts, checks for a winner, ends turns and rounds. */
export function settle(s: GameState): void {
  while (s.prompts[0] && isEmptyPrompt(s, s.prompts[0])) s.prompts.shift();
  if (s.phase !== 'playing' || s.prompts.length > 0) return;
  if (checkWin(s)) return;
  if (s.roundEnding) {
    endRound(s);
    return;
  }
  if (s.turnActionTaken) advanceTurn(s);
}
