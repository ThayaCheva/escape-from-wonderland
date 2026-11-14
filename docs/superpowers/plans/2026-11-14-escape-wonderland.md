# Escape from Wonderland — Digital Table Edition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single-screen browser game of *Escape from Wonderland* for 3–4 players sharing one mouse, enforcing every rule in the spec and using the owner's art.

**Architecture:** A pure TypeScript rules engine (`src/engine/`) owns all game state and exposes `step(state, action) → state`; multi-step card effects are a queue of prompts inside the state. A React UI (`src/ui/`) renders state, gates hidden information through a pure visibility module, and dispatches actions. A Python script crops the owner's print sheets into per-card images under `public/assets/`.

**Tech Stack:** TypeScript 6, React 19, Vite 8, Vitest 5, Python 3.13 + Pillow 12 (asset script only), `@fontsource/im-fell-english-sc` + `@fontsource/crimson-text`, Playwright 1.65 (one smoke test).

**Spec:** `docs/superpowers/specs/2026-11-14-escape-wonderland-design.md` — section numbers below (§5.5 etc.) refer to it. The spec is the authority on every rule; when a test below and the spec disagree, the spec wins and the test is fixed.

## Global Constraints

- No backend, no network calls at runtime; `npm run build` produces a static `dist/`.
- `src/engine/**` imports nothing from React, the DOM, `Math.random` or `Date`; all randomness goes through `src/engine/rng.ts` with the seed stored in state.
- TypeScript `strict: true`.
- Deck: 104 number cards (Red/White 1–13 ×4) + 18 actions (9 ×2) + 20 events (10 ×2) = **142**; counts live only in `DECK_COMPOSITION` in `src/engine/cards.ts`.
- Turn order is array order of `state.players`; edges are bottom → left → top → right (3 players: bottom, left, right). Alice per edge: bottom gold, left rose, top blue, right mint.
- Clockwise location order: `white-queen → mad-hatter → black-forest → chess → red-queen → white-queen`.
- A card face is rendered only when `src/ui/visibility.ts` says so (spec anti-goal: hands never leak).
- Every automatic effect appends a plain-English line to `state.log`; a log line never names a card still hidden in a hand (Vines' taken card, Caterpillar views, Mad Hatter's Party hands).
- Target screen ≥ 1366×768, mouse only, no hover-only controls.
- Assets read from `public/assets/`; the owner's source folder is used only by `tools/crop_assets.py`.

## Review Focus

1. **Soft-lock or lost cards in long games** — a random sequence of legal actions must never reach a state with no legal action, and the 142 cards must always all be somewhere (hands + deck + discard + pile + active). Test: seeded random-play fuzz test in Task 6.
2. **Corrupt or outdated save in `localStorage`** — the app must open to the title screen without "Continue", not crash. Test: `loadGame` cases in Task 8.
3. **Privacy when control returns to the current player** after another player's private prompt (Generosity, Tea, Caterpillar) — a hand-off banner must appear again and peek must be off. Test: `visibility` cases in Task 9.
4. **Very large hands** (20+ cards after Execution Order + Jabberwocky) — the fan must fit its edge without overlapping the corners. Test: `fanLayout` cases in Task 8.
5. **Deck and discard both empty when a draw is required** — the draw is skipped and the game continues. Test: `drawCards` case in Task 4.

---

## File Structure

```
package.json, tsconfig.json, vite.config.ts, index.html
tools/crop_assets.py                 # sheets → public/assets/*
public/assets/cards/*.png            # generated, committed
public/assets/tokens/*.png           # generated, committed
public/assets/board.jpg, title.jpg, background.jpg, card-back.png
src/engine/types.ts                  # all engine types
src/engine/cards.ts                  # card catalogue, deck composition, labels
src/engine/rng.ts                    # seeded RNG + shuffle
src/engine/board.ts                  # locations, clockwise order, names
src/engine/rules.ts                  # pure queries: legality, immunity, modifiers
src/engine/mutate.ts                 # draft mutators: draw, discard, move, log
src/engine/setup.ts                  # newGame + setup-pick resolution
src/engine/flow.ts                   # turns, rounds, win check, settle()
src/engine/effects/actions.ts        # 9 action effects + their prompt handlers
src/engine/effects/events.ts         # 10 event effects + their prompt handlers
src/engine/step.ts                   # step(), actingSeat(), IllegalActionError
src/engine/testkit.ts                # test-only state/card builders
src/engine/__tests__/*.test.ts
src/ui/main.tsx, App.tsx, styles.css
src/ui/useGame.ts, save.ts, visibility.ts, layout.ts, boardGeometry.ts, assets.ts
src/ui/components/*.tsx
src/ui/__tests__/*.test.ts
e2e/smoke.spec.ts, playwright.config.ts
```

---

### Task 1: Scaffold, engine types, card catalogue, RNG, testkit

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/ui/main.tsx` (renders "Escape from Wonderland" placeholder), `.gitignore` (`node_modules`, `dist`, `test-results`)
- Create: `src/engine/types.ts`, `src/engine/cards.ts`, `src/engine/rng.ts`, `src/engine/board.ts`, `src/engine/testkit.ts`
- Test: `src/engine/__tests__/cards.test.ts`, `src/engine/__tests__/rng.test.ts`

**Interfaces:**
- Produces (`types.ts`), used by every later task:

```ts
export type Seat = number;
export type Color = 'red' | 'white';
export type LocationId = 'white-queen' | 'mad-hatter' | 'black-forest' | 'chess' | 'red-queen';
export type Position = LocationId | 'outskirts';
export type Edge = 'bottom' | 'left' | 'top' | 'right';
export type AliceColor = 'gold' | 'rose' | 'blue' | 'mint';
export type ActionName = 'drink-me' | 'eat-me' | 'vorpal-sword' | 'cheshire-cat' | 'execution-order'
  | 'dead-red-knight' | 'dead-white-knight' | 'caterpillar' | 'exile';
export type EventName = 'wq-generosity' | 'tweedledee' | 'tweedledum' | 'jabberwocky' | 'mh-party'
  | 'tea-of-confusion' | 'rabbit-hole' | 'rq-decree' | 'shadow-creatures' | 'vines';
export type CardName = ActionName | EventName;
export interface NumberCard { id: string; kind: 'number'; color: Color; value: number }
export interface SpecialCard { id: string; kind: 'action' | 'event'; name: CardName }
export type Card = NumberCard | SpecialCard;
export interface CardDef { name: CardName; kind: 'action' | 'event'; title: string;
  location: LocationId | null; lasting: boolean; text: string }
export interface PileEntry { card: NumberCard; seat: Seat; effective: number; modifier: -1 | 0 | 1 }
export interface ActiveEntry { card: SpecialCard; seat: Seat }
export interface Player { name: string; alice: AliceColor; edge: Edge; hand: Card[];
  position: Position; down: boolean; skipNextTurn: boolean; drinkMeLock: 'none' | 'pending' | 'active' }
export type Prompt =
  | { type: 'setup-pick'; seat: Seat }
  | { type: 'drink-me-extra'; seat: Seat; remaining: number }
  | { type: 'eat-me'; seat: Seat }
  | { type: 'vorpal-target'; seat: Seat }
  | { type: 'execution-declare'; seat: Seat }
  | { type: 'execution-choose'; seat: Seat; value: number; bySeat: Seat }
  | { type: 'choose-player'; seat: Seat; purpose: 'caterpillar' | 'exile' | 'vines'; options: Seat[] }
  | { type: 'view-hand'; seat: Seat; target: Seat }
  | { type: 'exile-location'; seat: Seat; target: Seat }
  | { type: 'vines-take'; seat: Seat; target: Seat }
  | { type: 'vines-give'; seat: Seat; target: Seat; takenCardId: string }
  | { type: 'discard'; seat: Seat; min: number; max: number; drawAfter: number; reason: string }
  | { type: 'round-end-move'; seat: Seat };
export type GameAction =
  | { type: 'setup-pick'; seat: Seat; cardId: string | null }
  | { type: 'play'; seat: Seat; cardId: string }
  | { type: 'pass'; seat: Seat }
  | { type: 'choose-cards'; seat: Seat; cardIds: string[] }
  | { type: 'choose-seat'; seat: Seat; target: Seat }
  | { type: 'choose-location'; seat: Seat; location: LocationId | null }
  | { type: 'choose-value'; seat: Seat; value: number }
  | { type: 'choose-active'; seat: Seat; index: number }
  | { type: 'choose-hand-index'; seat: Seat; index: number }
  | { type: 'ack'; seat: Seat }
  | { type: 'done'; seat: Seat };
export interface GameState {
  version: 1; phase: 'setup' | 'playing' | 'game-over';
  players: Player[]; deck: Card[]; discard: Card[]; pile: PileEntry[]; active: ActiveEntry[];
  current: Seat; lastNumberSeat: Seat | null; round: number;
  cheshireUsedThisRound: boolean; turnActionTaken: boolean;
  roundEnding: { starter: Seat } | null;
  effectCauser: Seat | null;           // seat whose card started the current effect (win tie-break)
  setupPicks: Record<number, string | null>;
  prompts: Prompt[];                   // front = prompts[0]
  winner: Seat | null; log: string[]; seed: number;
}
```

- Produces (`cards.ts`): `DECK_COMPOSITION = { numberCopies: 4, specialCopies: 2 }`; `CARD_DEFS: Record<CardName, CardDef>` (titles and `text` copied from the card art, `location` per §5.1, `lasting` true for cheshire-cat, dead-red-knight, dead-white-knight, tweedledee, tweedledum, jabberwocky, shadow-creatures); `buildDeck(): Card[]` with ids `R9-1`…`R9-4`, `W13-2`, `drink-me-1`, `vines-2`; `cardLabel(card: Card): string` → `"Red 9"`, `"White 13"`, or the def title; `isNumber(card): card is NumberCard`.
- Produces (`rng.ts`): `nextRandom(seed: number): [number, number]` (mulberry32, value in [0,1), new seed); `shuffle<T>(items: readonly T[], seed: number): [T[], number]` (Fisher–Yates).
- Produces (`board.ts`): `LOCATIONS: readonly LocationId[]` in clockwise order; `nextLocationClockwise(loc: LocationId): LocationId`; `LOCATION_NAMES: Record<Position, string>` (`outskirts` → "the Outskirts").
- Produces (`testkit.ts`, tests only): `num(color: 'R' | 'W', value: number): NumberCard` and `sp(name: CardName): SpecialCard` (unique ids from a counter); `makeState(opts: { players: Array<Partial<Player>>; pile?: PileEntry[]; active?: ActiveEntry[]; current?: Seat; deck?: Card[]; discard?: Card[]; lastNumberSeat?: Seat | null }): GameState` (phase `'playing'`, defaults: names "P0".., edges by Global Constraints, position `outskirts`, empty hands, `seed: 1`); `pileOf(card: NumberCard, seat?: Seat, modifier?: -1|0|1): PileEntry`.

- [ ] **Step 1: Scaffold.** `npm init -y`; install `react react-dom @fontsource/im-fell-english-sc @fontsource/crimson-text` and dev `typescript vite @vitejs/plugin-react vitest @types/react @types/react-dom`. Scripts: `dev: vite`, `build: tsc --noEmit && vite build`, `test: vitest run`, `preview: vite preview`. `vite.config.ts` uses the React plugin and `base: './'` (so `dist/` opens from any static host).

- [ ] **Step 2: Write failing tests**

```ts
// cards.test.ts
it('builds the 142-card deck', () => {
  const deck = buildDeck();
  expect(deck).toHaveLength(142);
  expect(deck.filter(isNumber)).toHaveLength(104);
  expect(deck.filter(c => c.kind === 'action')).toHaveLength(18);
  expect(deck.filter(c => c.kind === 'event')).toHaveLength(20);
  expect(new Set(deck.map(c => c.id)).size).toBe(142);
  expect(deck.filter(c => isNumber(c) && c.color === 'red' && c.value === 9)).toHaveLength(4);
});
it('labels cards', () => {
  expect(cardLabel(num('R', 9))).toBe('Red 9');
  expect(cardLabel(sp('vines'))).toBe('Vines of the Black Forest');
});
it('ties events to locations', () => {
  expect(CARD_DEFS.jabberwocky.location).toBe('chess');
  expect(CARD_DEFS['drink-me'].location).toBeNull();
});
// rng.test.ts
it('shuffle is deterministic per seed and a permutation', () => {
  const [a] = shuffle([1,2,3,4,5,6,7,8], 42); const [b] = shuffle([1,2,3,4,5,6,7,8], 42);
  expect(a).toEqual(b); expect([...a].sort()).toEqual([1,2,3,4,5,6,7,8]);
});
it('nextLocationClockwise wraps red-queen to white-queen', () => {
  expect(nextLocationClockwise('red-queen')).toBe('white-queen');
});
```

- [ ] **Step 3:** Run `npx vitest run` — expect FAIL (modules missing).
- [ ] **Step 4:** Implement `types.ts`, `cards.ts`, `rng.ts`, `board.ts`, `testkit.ts` per Interfaces.
- [ ] **Step 5:** Run `npx vitest run` — expect PASS; `npm run build` — expect success.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: scaffold project with engine types, card catalogue and RNG"`

---

### Task 2: Rules queries (legality, modifiers, immunity)

**Files:**
- Create: `src/engine/rules.ts`
- Test: `src/engine/__tests__/rules.test.ts`

**Interfaces:**
- Consumes: Task 1 types, `CARD_DEFS`, `testkit`.
- Produces:
  - `type EffectSource = { kind: 'action' | 'event'; bySeat: Seat }`
  - `type PlayCheck = { ok: true } | { ok: false; reason: string }`
  - `hasCheshire(state, seat): boolean` — an active cheshire-cat owned by `seat`.
  - `locationEffectsOn(state, seat): boolean` — false if any active shadow-creatures exists, **except** when every active shadow-creatures was played by someone else and `seat` has Cheshire (§5.5).
  - `modifierFor(state, seat): -1 | 0 | 1` — white-queen −1, red-queen +1, only if `locationEffectsOn`.
  - `isImmune(state, seat, source: EffectSource): boolean` — Chess (`source.kind==='event'`, position `chess`, `locationEffectsOn`) **or** Cheshire (`hasCheshire && source.bySeat !== seat`).
  - `colorRule(state, seat): { mode: 'any' } | { mode: 'must'; color: Color } | { mode: 'not'; color: Color }` — any if pile empty or at mad-hatter with effects on; else `must` the newest active knight's colour unless that knight's owner ≠ seat and seat has Cheshire; else `not` top colour.
  - `checkPlay(state, seat, cardId, opts?: { free?: boolean }): PlayCheck` — all of §5.3 plus card-specific playability; `free` = Drink Me extra (numbers skip value/colour). Reasons are short player-facing strings.
  - `nextSeat(state, seat): Seat`; `nextUpSeat(state, seat): Seat | null` (next clockwise, not `down`, ≠ seat).

`checkPlay` rejections, in this order (first match wins):
1. Card not in that player's hand → "That card isn't in your hand."
2. `drinkMeLock === 'active'` and card not a number → "Drink Me: only number cards this turn."
3. Number, not free: value fails → `"Must be at least ${top.effective}."`; colour fails → `"Must be Red."` / `"Must be White."` (combine as `"Must be White and at least 9."` when both fail).
4. Action at black-forest with `locationEffectsOn` → "No Action cards in the Black Forest."
5. Event not at its location → `"Only playable at ${LOCATION_NAMES[loc]}."`
6. cheshire-cat and `cheshireUsedThisRound` → "Only one Cheshire Cat per round."
7. vorpal-sword with no active entry other than cheshire-cat → "Nothing to slay."
8. caterpillar / vines with no valid target (other seats, not immune to this source, hand non-empty) → "No one to target."
9. vines when the player's hand has no card other than this one → "You need a card to swap."
10. drink-me with `opts.free` → "Drink Me can't be played as an extra card." (my call: keeps chains bounded)

- [ ] **Step 1: Write failing tests** — one `it` per line, each a hand-built state via `makeState`:
  - empty pile: any number card ok.
  - top W9 (effective 9): R9 ok; R10 ok; R8 → `"Must be at least 9."`; W12 → `"Must be Red."`; W8 → `"Must be Red and at least 9."`.
  - player at red-queen, top W9: R8 ok (effective 9); `modifierFor` = 1.
  - player at white-queen, top W9: R9 rejected (effective 8).
  - player at mad-hatter, top W9: W10 ok.
  - active dead-red-knight (seat 1), top R5, seat 0 plays R6 → ok; W6 → `"Must be Red."`.
  - same knight, seat 0 at mad-hatter: W6 ok.
  - same knight, seat 0 has Cheshire: R6 → rejected (`not` red), W6 ok.
  - two knights active, newest is white: `colorRule` = `{ mode:'must', color:'white' }`.
  - active shadow-creatures (seat 1): seat 0 at red-queen → `modifierFor` 0; seat 0 at black-forest may play an action; seat 0 at chess not immune to events.
  - shadow-creatures by seat 1, seat 0 has Cheshire → `locationEffectsOn(state,0)` true; shadow by seat 0 itself with Cheshire → false.
  - `isImmune` chess vs action source → false; chess vs event → true; cheshire vs own card → false.
  - black-forest + action → "No Action cards in the Black Forest."; event elsewhere → "Only playable at the Black Forest." (use `LOCATION_NAMES['black-forest']` = "the Black Forest").
  - drinkMeLock active: number ok, action rejected.
  - vorpal with only a cheshire active → "Nothing to slay."; with jabberwocky active → ok.
  - second cheshire when `cheshireUsedThisRound` → rejected.
  - vines as only card → "You need a card to swap."; vines when all others are at chess → "No one to target."
  - free play: W2 on top W13 → ok; drink-me free → rejected.
  - `nextUpSeat` skips down players and returns null when everyone else is down.
- [ ] **Step 2:** `npx vitest run src/engine/__tests__/rules.test.ts` — expect FAIL.
- [ ] **Step 3:** Implement `rules.ts` per Interfaces.
- [ ] **Step 4:** Re-run — expect PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(engine): rules queries for legality, modifiers and immunity"` (add new files first).

---

### Task 3: Mutators, newGame and setup picks

**Files:**
- Create: `src/engine/mutate.ts`, `src/engine/setup.ts`, `src/engine/step.ts` (initial: setup-pick only)
- Test: `src/engine/__tests__/setup.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces (`mutate.ts`, all mutate a draft `s: GameState` in place):
  - `log(s, msg: string): void`
  - `drawCards(s, seat, n): number` — draws one at a time; when deck empty, shuffles `discard` into `deck` (using/advancing `s.seed`, logging "The discard pile is shuffled into a new deck."); if both empty, stops. Returns cards drawn.
  - `removeFromHand(s, seat, cardId): Card` (throws `IllegalActionError` if absent)
  - `discardFromHand(s, seat, cardIds: string[]): void`
  - `moveToken(s, seat, to: Position): void` — sets position, logs, and if the player owns an active shadow-creatures and leaves black-forest, moves that entry to discard and logs it.
  - `placeNumber(s, seat, card: NumberCard): void` — pushes `PileEntry` with `modifier = modifierFor(s, seat)`, `effective = value + modifier`, sets `lastNumberSeat = seat`, logs `"Rose plays Red 9 (Red Queen's Castle: counts as 10)."` (suffix only when modifier ≠ 0).
- Produces (`setup.ts`): `newGame(opts: { playerCount: 3 | 4; names?: string[]; seed: number }): GameState` — shuffle, deal 7 each, phase `'setup'`, one `setup-pick` prompt per seat in order. `resolveSetup(s): void` (called when the last pick arrives).
- Produces (`step.ts`): `class IllegalActionError extends Error`; `step(state: GameState, action: GameAction): GameState` — `structuredClone`, validate `action.seat === actingSeat(state)` and the action type matches the front prompt — `play` and `done` answer `drink-me-extra`; with no prompt only `play`/`pass` are valid (else throw), dispatch, then `settle(s)` (Task 4 adds `settle`; in this task call a no-op). `actingSeat(state): Seat` — front prompt's seat, else `state.current`.

`resolveSetup` (§5.2): sort picked cards ascending by `(value, red before white, then random order via rng for identical cards — log "Tie between X and Y broken at random.")`; push them onto `pile` in that order with modifier 0; first card's seat becomes `current`; last card's seat becomes `lastNumberSeat`; if nobody picked, redeal (new shuffle, new prompts). Phase → `'playing'`, `round = 1`, then `startTurn` (Task 4; no-op stub here).

- [ ] **Step 1: Write failing tests**
  - `newGame({playerCount:4, seed:7})`: 4 hands of 7, deck 114, prompts are 4 `setup-pick` for seats 0..3, edges `bottom,left,top,right`, alices `gold,rose,blue,mint`.
  - `newGame({playerCount:3, seed:7})`: edges `bottom,left,right`, alices `gold,rose,mint`, deck 121.
  - picks W5 (seat0), R5 (seat1), R2 (seat2), W13 (seat3): `current` = 2, pile values `[2,5,5,13]` with colours `[red,red,white,white]`, `lastNumberSeat` = 3, phase `'playing'`.
  - picking a non-number card throws `IllegalActionError`; picking `null` while holding a number card throws.
  - a player with no number card may pick `null` and is excluded.
  - two identical R4 picks: result deterministic for a fixed seed and log contains "broken at random".
  - `drawCards` reshuffles discard when deck is empty (deck 0, discard 3 → draws 2, deck 1, discard 0).
  - **(Review Focus 5)** `drawCards` with deck and discard both empty returns 0 and leaves the hand unchanged.
  - `moveToken` out of black-forest discards that player's shadow-creatures; another player's stays.
- [ ] **Step 2:** Run — expect FAIL.
- [ ] **Step 3:** Implement per Interfaces.
- [ ] **Step 4:** Run — expect PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(engine): newGame, setup picks and state mutators"`

---

### Task 4: Turns, passing, rounds and winning

**Files:**
- Create: `src/engine/flow.ts`
- Modify: `src/engine/step.ts` (handle `play`, `pass`, `choose-location` for `round-end-move`, `done`; call `settle`)
- Test: `src/engine/__tests__/flow.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces (`flow.ts`):
  - `startTurn(s, seat): void` — sets `current`, `turnActionTaken=false`, `effectCauser=null`; if `skipNextTurn` → clear it, log "X's turn is skipped.", call `advanceTurn`; else `drinkMeLock 'pending'→'active'`; then for each active jabberwocky where `!isImmune(s, seat, {kind:'event', bySeat: owner})` draw 1 (log).
  - `advanceTurn(s): void` — clears current player's `drinkMeLock 'active'→'none'`, then `startTurn(s, nextSeat(s, s.current))`.
  - `checkWin(s): boolean` — players with empty hands; winner = first clockwise starting from `s.effectCauser ?? s.current`; sets `winner`, phase `'game-over'`, logs "X escapes Wonderland!".
  - `endRound(s): void` — §5.6 steps 2–4: pile + active → discard; `cheshireUsedThisRound=false`; all `down=false`; `round++`; starter = `roundEnding.starter`; each player draws 1 starting with starter clockwise; `roundEnding=null`; `lastNumberSeat=null`; `startTurn(s, starter)`.
  - `settle(s): void` — runs after every action:

```ts
function settle(s) {
  // drop prompts that have no possible answer
  while (s.prompts[0] && isEmptyPrompt(s, s.prompts[0])) s.prompts.shift();
  if (s.phase !== 'playing' || s.prompts.length > 0) return;
  if (checkWin(s)) return;
  if (s.roundEnding) return endRound(s);
  if (s.turnActionTaken) advanceTurn(s);
}
// isEmptyPrompt: discard with empty hand; drink-me-extra with empty hand;
// eat-me with no number card of value <= 5.
```

- `step` handlers added here:
  - `play` (no prompt at front; phase playing): `checkPlay` must be ok; remove from hand; if the player was `down`, set `down=false` and log "X rejoins."; numbers → `placeNumber`; specials → push to `active` if `lasting` else to `discard`, set `effectCauser = seat`, log "X plays Exile.", call `resolveSpecial(s, seat, card)` (a dispatcher in `step.ts` that Tasks 5–6 fill; until then a no-op). Set `turnActionTaken = true`.
  - `pass`: set `down=true` (log "X passes." or "X stays down."); `turnActionTaken = true`; if exactly one player is not down → `roundEnding = { starter: thatSeat }` and, if `lastNumberSeat !== null`, push `{ type:'round-end-move', seat: lastNumberSeat }`.
  - `choose-location` on `round-end-move`: `location === null` → stay (log), else `moveToken`.

- [ ] **Step 1: Write failing tests**
  - legal number play moves card to pile, sets `lastNumberSeat`, advances `current` to next seat.
  - illegal play (W8 on W9) throws `IllegalActionError` and leaves the input state untouched.
  - acting out of turn throws.
  - pass sets `down`; a down player playing a card rejoins (`down=false`, log contains "rejoins").
  - 4 players, seats 1–3 pass in a row after seat 0's play → `round-end-move` prompt for seat 0; answering `choose-location 'mad-hatter'` → seat 0 at mad-hatter, pile empty, all hands +1, round 2, `current` = 0.
  - round end with `lastNumberSeat` null (round where only actions were played) → no move prompt, next round starts directly.
  - round end where the last number player ≠ the last player standing: move prompt goes to the last number player, next round starts with the one standing.
  - `skipNextTurn` player is skipped once and the flag clears.
  - Drink Me lock: `pending` becomes `active` on their next turn, then `none` after that turn.
  - playing your last card ends the game: `phase 'game-over'`, `winner` = that seat.
  - simultaneous empty hands (hand-built: seats 1 and 3 at 0 cards, `effectCauser` 2) → winner 3.
  - lasting special goes to `active`, non-lasting to `discard`.
- [ ] **Step 2:** Run — expect FAIL.
- [ ] **Step 3:** Implement `flow.ts` and the `step.ts` handlers; wire `startTurn` into `resolveSetup`.
- [ ] **Step 4:** Run all tests — expect PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(engine): turns, passing, round end and win detection"`

---

### Task 5: Action card effects

**Files:**
- Create: `src/engine/effects/actions.ts`
- Modify: `src/engine/step.ts` (route action cards and their prompts)
- Test: `src/engine/__tests__/actions.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4 (`mutate.ts`, `rules.ts`, `flow.ts`).
- Produces:
  - `ACTION_EFFECTS: Record<ActionName, (s: GameState, seat: Seat, card: SpecialCard) => void>`
  - `ACTION_PROMPT_HANDLERS: { [K in Prompt['type']]?: (s: GameState, prompt: Extract<Prompt,{type:K}>, action: GameAction) => void }` — each handler validates the answer (throws `IllegalActionError`), shifts the prompt, applies the effect.
  - `step.ts` merges `ACTION_PROMPT_HANDLERS` and (Task 6) `EVENT_PROMPT_HANDLERS` into one lookup.

Behaviour (spec §5.5, Action table) — each prompt below is pushed to the **front** of the queue:

| Card | Effect / prompts |
|---|---|
| drink-me | `drinkMeLock='pending'`; push `drink-me-extra {remaining:2}`. Answer `play` (checked with `{free:true}`; numbers via `placeNumber`, specials resolved normally — their prompts go in front of the remaining `drink-me-extra`, which is re-pushed with `remaining-1` if > 0) or `done` (shift). |
| eat-me | push `eat-me`; answer `choose-cards` = number cards whose printed sum ≤ 5 (empty allowed). |
| vorpal-sword | push `vorpal-target`; answer `choose-active` with index of a non-cheshire entry → that entry to discard, log "X slays the Jabberwocky." |
| cheshire-cat | `cheshireUsedThisRound = true` (card already in `active`). |
| execution-order | push `execution-declare`; answer `choose-value` 1–13. Target = `nextUpSeat(s, seat)`. If target null or `isImmune(target, {kind:'action', bySeat})` → log no effect. Matches = target's numbers with that value: 0 → target draws 5; 1 → forced play; ≥2 → push `execution-choose` for target, answer `choose-cards` with one matching id → forced play. Forced play = `placeNumber(s, target, card)`, `target.skipNextTurn = true`, user draws 5. |
| dead-red-knight / dead-white-knight | remove any other knight from `active` to `discard`; user draws 1. |
| caterpillar | push `choose-player {purpose:'caterpillar', options}` (other, non-immune, non-empty hand); answer → push `view-hand {seat:user, target}` then `view-hand {seat:target, target:user}`; each answered with `ack`. |
| exile | push `choose-player {purpose:'exile', options}` (all seats except Cheshire-immune others); answer → push `exile-location {target}`; answer `choose-location` ≠ target's position and ≠ null → `moveToken`, target draws 1. |

- [ ] **Step 1: Write failing tests** (one `it` each; hand-built states; drive with `step`):
  - drink-me: after playing, prompt `drink-me-extra remaining 2`; free-play W2 onto W13 succeeds; second extra then turn ends; next turn an action play is rejected with the Drink Me reason.
  - drink-me: `done` immediately ends the turn; drink-me played as last card → game over, no extra prompt.
  - drink-me extra that is an exile → exile prompts resolve before the remaining extra prompt.
  - eat-me: discarding R2+W3 ok; R2+W4 throws; empty selection ok; hand with only numbers > 5 → no prompt.
  - vorpal: slays jabberwocky (both to discard); index pointing at cheshire throws.
  - cheshire: second copy rejected same round; allowed after `endRound`.
  - execution-order: target holds no 7 → target +5 cards; target holds one R7 → R7 on pile, `lastNumberSeat`=target, target skips next turn, user +5; target holds R7 and W7 → `execution-choose` prompt for target; next seat down → target is the following up seat; target with Cheshire → no draws.
  - dead-white-knight after dead-red-knight → only white knight active; user drew 1 each time.
  - caterpillar: prompts are `view-hand(user→target)` then `view-hand(target→user)`; Cheshire players not in options.
  - exile: self allowed; same location throws; moving a shadow-creatures owner out of black-forest discards it; moved player +1 card.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(engine): action card effects"`

---

### Task 6: Event card effects and the random-play fuzz test

**Files:**
- Create: `src/engine/effects/events.ts`, `src/engine/__tests__/fuzz.test.ts`
- Modify: `src/engine/step.ts`
- Test: `src/engine/__tests__/events.test.ts`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: `EVENT_EFFECTS: Record<EventName, (s, seat, card) => void>`; `EVENT_PROMPT_HANDLERS` (same shape as Task 5). "Participants" below = seats where `!isImmune(s, x, {kind:'event', bySeat: user})`, in clockwise order **starting with the user**.

| Card | Effect / prompts |
|---|---|
| wq-generosity | push `discard {min:1,max:1,drawAfter:0}` for each participant with cards. |
| tweedledee / tweedledum | partner = earliest active entry of the other name (excluding this card). None → stays in `active` (waiting). Found → both entries to discard; if same owner push one `discard {min:0,max:4}`, else push `discard {min:0,max:2}` for user then partner. Immunity not applied. |
| jabberwocky | nothing now (lasting; draws happen in `startTurn`, already stacking per active copy). |
| mh-party | participants list `p`; new hand of `p[i-1]` = old hand of `p[i]` (indices mod length) — i.e. each passes to the previous participant in turn order. Log "Hands pass to the right." |
| tea-of-confusion | push `discard {min:0,max:2,drawAfter:2}` for each participant (the handler draws `drawAfter` after discarding). |
| rabbit-hole | each participant not in outskirts → `moveToken(nextLocationClockwise(pos))`. |
| rq-decree | each participant draws 1. |
| shadow-creatures | nothing now (lasting; `locationEffectsOn` reads it; `moveToken` removes it). |
| vines | push `choose-player {purpose:'vines'}` (others, non-immune, non-empty hand) → push `vines-take {target}`; answer `choose-hand-index` (0-based into target's hand) moves that card to user → push `vines-give {takenCardId}`; answer `choose-cards` with one id ≠ `takenCardId` → moves it to target. Log never names the taken card. |

The shared `discard` prompt handler (here, used by Task 5 too if needed): `choose-cards` length within `[min(min, hand), max]`, all in hand → `discardFromHand`, then `drawCards(drawAfter)`.

- [ ] **Step 1: Write failing tests** (`events.test.ts`):
  - generosity: prompts for user then clockwise; a Chess player and a player with 0 cards are skipped; choosing 0 cards throws (min 1).
  - tweedles: dee waits; dum by another player → both discarded, prompts `discard max 2` for dum's player then dee's player; same player both → one prompt max 4; two dees waiting, dum pairs with the earlier; waiting tweedle is discarded at round end.
  - jabberwocky: 2 active → non-immune player draws 2 at turn start; owner on chess draws 0.
  - mh-party with 4 players, seat 2 on chess: hands of 0→3, 1→0, 3→1 (old hand of seat 1 now in seat 0, etc.), seat 2 unchanged.
  - tea: discard 2 then hand +2; discarding to 0 then drawing 2 does **not** win.
  - rabbit-hole: red-queen → white-queen, black-forest → chess, outskirts unchanged, chess player unchanged; a shadow owner moved out of black-forest loses the card.
  - rq-decree: everyone non-immune including user +1.
  - shadow-creatures: two copies; removing one keeps location effects off.
  - vines: take index 0 from target, give a different card; giving the taken card throws; log has no label of the taken card.
- [ ] **Step 2: Write the fuzz test (Review Focus 1)** — `fuzz.test.ts`, `it('200 seeded random games never stall and conserve 142 cards')`: for seeds 1..200, `newGame({playerCount: seed % 2 ? 4 : 3, seed})`, then loop ≤ 3000 steps: build a random **legal** action for `actingSeat` with a test-local `randomAction(state, rand)` (setup-pick → random number card or null; no prompt → random card with `checkPlay` ok, else pass; each prompt type → a random valid answer); call `step`; after every step assert total cards across hands/deck/discard/pile/active === 142 and that `randomAction` found an action. Each game must reach `game-over` or 3000 steps without throwing.
- [ ] **Step 3:** Run — FAIL. **Step 4:** Implement `events.ts`, wire into `step.ts`, fix anything the fuzz test finds.
- [ ] **Step 5:** `npx vitest run` — all PASS.
- [ ] **Step 6: Commit** — `git commit -m "feat(engine): event card effects and random-play fuzz test"`

---

### Task 7: Asset pipeline

**Files:**
- Create: `tools/crop_assets.py`, generated `public/assets/**`

**Interfaces:**
- Produces files the UI (Task 8) references by exact name:
  - `public/assets/cards/R1.png`…`R13.png`, `W1.png`…`W13.png` (500×710)
  - `public/assets/cards/<CardName>.png` for all 19 names (e.g. `drink-me.png`, `vines.png`)
  - `public/assets/cards/back.png` — generated: navy `#2a2d37` fill, `card.png`'s line art recoloured gold `#b8974f`
  - `public/assets/tokens/alice-gold.png`, `alice-rose.png`, `alice-blue.png`, `alice-mint.png`, `plus1.png`, `minus1.png` (circular alpha mask, 256×256)
  - `public/assets/board.jpg` (2475 px wide), `title.jpg`, `background.jpg` (1920 px wide)

Usage: `python -I tools/crop_assets.py "<source folder>" public/assets`. Sources: `1-9-red.jpg`, `1-9-white.jpg`, `10-13.jpg` (row 1: R11 R12 R13; row 2: R10, blank, W13; row 3: W12 W11 W10), `new_action.jpg` (row-major: drink-me, eat-me, vorpal-sword, cheshire-cat, execution-order, dead-red-knight, dead-white-knight, caterpillar, exile), `new_event.jpg` (row-major: wq-generosity, tweedledee, tweedledum, jabberwocky, mh-party, tea-of-confusion, rabbit-hole, rq-decree, shadow-creatures), `new_token.jpg` (vines = top-left card; +1/−1 circles left column; Alices bottom-right: gold top-left, rose top-right, blue bottom-left, mint bottom-right), `wonderland_board.jpg`, `title.jpg`, `background.jpg`, `card.png`.

Starting grid for the 2492×3508 sheets (verify, then adjust constants): columns x ≈ 123–852, 872–1604, 1624–2357; rows y ≈ 181–1220, 1240–2280, 2298–3339. Inset each crop ~6 px so no neighbouring border shows.

- [ ] **Step 1:** Write the script with crop constants at the top and a `--contact-sheet` flag that also writes `scratch/contact.png` (all outputs tiled, labelled) for checking.
- [ ] **Step 2:** Run it; open the contact sheet with the Read tool and check every card: right card under the right name, no neighbour edges, Alices centred in their circles. Adjust constants and re-run until correct.
- [ ] **Step 3:** Confirm 26 + 19 + 1 card files and 6 token files exist (`ls public/assets/cards | wc -l` → 46).
- [ ] **Step 4: Commit** — `git add tools public/assets && git commit -m "feat: crop the owner's card sheets into game assets"` (do not commit `scratch/`; add it to `.gitignore`).

---

### Task 8: UI shell — screens, save, static table

**Files:**
- Create: `src/ui/App.tsx`, `src/ui/useGame.ts`, `src/ui/save.ts`, `src/ui/layout.ts`, `src/ui/boardGeometry.ts`, `src/ui/assets.ts`, `src/ui/styles.css`
- Create: `src/ui/components/TitleScreen.tsx`, `NewGameScreen.tsx`, `EndScreen.tsx`, `Table.tsx`, `Board.tsx`, `PlayerEdge.tsx`, `Hand.tsx`, `Card.tsx`
- Modify: `src/ui/main.tsx`
- Test: `src/ui/__tests__/save.test.ts`, `src/ui/__tests__/layout.test.ts`

**Interfaces:**
- Consumes: engine `newGame`, `step`, `actingSeat`, `IllegalActionError`, types; Task 7 asset paths.
- Produces:
  - `save.ts`: `SAVE_KEY = 'escape-wonderland/save/v1'`; `saveGame(state: GameState): void`; `loadGame(): GameState | null` — returns null and removes the key on JSON error, `version !== 1`, or missing `players`/`prompts` arrays; `clearSave(): void`. All storage access in try/catch.
  - `useGame(): { state: GameState | null; start(opts): void; dispatch(a: GameAction): string | null /* error message */; quit(): void }` — saves after each successful step; clears save on `game-over`.
  - `layout.ts`: `EDGE_ROTATION: Record<Edge, number>` (bottom 0, left 90, top 180, right −90); `fanLayout(count: number, available: number, cardWidth: number): { step: number; total: number }` — `step = count <= 1 ? 0 : min(cardWidth * 0.75, (available - cardWidth) / (count - 1))`, `total = cardWidth + step * (count - 1)`.
  - `boardGeometry.ts` (percent of board image): `LOCATION_AREAS: Record<LocationId, { cx; cy; rx; ry }>` starting values white-queen (36.5, 72, 11, 16), mad-hatter (38, 38, 9, 13), black-forest (50, 24, 11, 9), chess (62, 38, 9, 13), red-queen (64.5, 72, 11, 16); `TOKEN_SLOTS: Record<Position, Array<{x;y}>>` (4 per position; outskirts around (50, 50)); `DECK_BOX` (81–96 %, 67–93 %), `DISCARD_BOX` (3.7–18.7 %, 67–93 %), `PILE_POINT` (50, 64), `ACTIVE_ROW` (50, 82). Tune by eye in Task 10.
  - `assets.ts`: `cardImage(card: Card): string`, `CARD_BACK`, `aliceImage(c: AliceColor)`, `MODIFIER_IMAGE: Record<-1|1, string>`.
  - `Card` props: `{ card: Card | null /* null = back */; faceUp: boolean; selected?: boolean; dimmed?: boolean; modifier?: -1|0|1; onClick?(): void; size: 'hand' | 'pile' | 'preview' }`.

Screens: Title (`title.jpg`, buttons New game / Continue game (only when `loadGame()` non-null)); New game (3 or 4 players, optional name per seat, Start → `newGame({playerCount, names, seed: Date.now() >>> 0})` — UI may use Date); Table (background, board with tokens/deck/discard/pile/active, four `PlayerEdge`s with hands always face down in this task; each plate shows the Alice portrait, name, card count and status chips — "Your turn", "Down", "Immune (Cheshire)", "Immune to events (Chess)", "Drink Me: numbers only", "Skips next turn"); End ("<Name> escaped Wonderland!", Alice portrait, New game). Fonts: headings IM Fell English SC, body Crimson Text, palette navy `#2a2d37`, gold `#b8974f`, parchment `#ece8e1`.

- [ ] **Step 1: Write failing tests**
  - **(Review Focus 2)** `loadGame` returns null and removes the key for: invalid JSON; `{version: 0}`; `{version:1}` without `players`; returns the state for a valid saved `newGame`.
  - **(Review Focus 4)** `fanLayout(25, 500, 70)`: `total <= 500` and `step > 0`; `fanLayout(1, 500, 70)` → `{step:0,total:70}`; `fanLayout(5, 500, 70).step === 52.5`.
- [ ] **Step 2:** `npx vitest run src/ui` — FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** `npm run dev`; open in a browser at 1366×768; start a 4-player game; confirm all four edges, tokens in the Outskirts, deck and discard boxes aligned with the board art, no card face visible. Repeat for 3 players (top edge empty).
- [ ] **Step 6: Commit** — `git commit -m "feat(ui): title, setup, end screens, autosave and static table"`

---

### Task 9: UI interaction — hand-offs, peeking, playing, prompts, log, rules

**Files:**
- Create: `src/ui/visibility.ts`, `src/ui/components/HandoffBanner.tsx`, `CardPreview.tsx`, `PromptPanel.tsx`, `GameLog.tsx`, `RulesPanel.tsx`
- Modify: `Table.tsx`, `PlayerEdge.tsx`, `Hand.tsx`, `Board.tsx`
- Test: `src/ui/__tests__/visibility.test.ts`

**Interfaces:**
- Consumes: Tasks 1–8; engine `checkPlay` for legal/dim state and reasons.
- Produces (`visibility.ts`):
  - `interface UiGate { confirmedSeat: Seat | null; peeked: boolean }`
  - `needsHandoff(state, gate): boolean` — `actingSeat(state) !== gate.confirmedSeat` (phase not game-over).
  - `confirm(state): UiGate` — `{ confirmedSeat: actingSeat(state), peeked: false }`.
  - `promptNeedsOwnHand(p: Prompt | undefined): boolean` — true for `setup-pick`, `drink-me-extra`, `eat-me`, `execution-choose`, `vines-give`, `discard`.
  - `faceUpHandSeat(state, gate): Seat | null` — `gate.confirmedSeat` if no hand-off is needed and (`gate.peeked` or `promptNeedsOwnHand(front)`), else null.
  - `revealedOtherHand(state, gate): Seat | null` — for a front `view-hand` prompt with no hand-off needed, its `target`.

Interaction rules (spec §6.2–6.5):
- Hand-off banner text: no prompt → "**<Name>'s turn** — click to begin"; prompt for another seat → "**Pass the mouse to <Name>.** Everyone else look away. Click when ready."; setup → "**<Name>: choose your starting card.** Everyone else look away."
- Peek button toggles `peeked` (only for `confirmedSeat`). Gate is replaced by `confirm()` on each banner click, so peek resets.
- In a face-up hand: legal cards normal, illegal dimmed; clicking any card opens `CardPreview` (enlarged, rotated to the player) with **Play** if `checkPlay` ok, else the reason. Pass / Stay down button on the plate.
- `PromptPanel` renders one UI per prompt type: card multi-select with a live constraint line and Confirm (eat-me shows printed-sum, discard shows "choose 1" / "up to 2"); value buttons 1–13; Done/Stay here buttons; player choices highlight valid plates (click plate); location choices highlight valid areas on the board (click area); `vines-take` shows the target's hand as face-down backs to click; `view-hand` shows the revealed hand and an OK button; `vorpal-target` makes active cards clickable. Panel and preview are rotated by `EDGE_ROTATION[edge of acting seat]`.
- `GameLog`: last ~6 lines, scrollable. `RulesPanel`: player-facing rewrite of spec §5 (setup, turn, locations, round end, winning, card rulings table), opened from a Rules button.
- Every dispatch error (`string` from `useGame().dispatch`) shows as a brief toast.

- [ ] **Step 1: Write failing tests (`visibility.test.ts`)**
  - fresh game: `needsHandoff` true; after `confirm` → false and `faceUpHandSeat` = 0 (setup-pick needs own hand).
  - no prompt, confirmed, not peeked → `faceUpHandSeat` null; peeked → current seat.
  - **(Review Focus 3)** state where the front prompt is a `discard` for seat 2 while `current` is 0 and gate `{confirmedSeat:0, peeked:true}` → `needsHandoff` true and `faceUpHandSeat` null; after answering (prompt gone, acting seat back to 0) with gate `{confirmedSeat:2, peeked:false}` → `needsHandoff` true, `faceUpHandSeat` null.
  - `view-hand {seat:1,target:3}` confirmed for 1 → `revealedOtherHand` 3 and `faceUpHandSeat` null (viewer's own hand not shown).
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement `visibility.ts` and the components. **Step 4:** Run — PASS.
- [ ] **Step 5:** `npm run dev`; play the setup pick and three full turns by hand; confirm: banner between every turn, peek works and resets, illegal card shows its reason, a pass and rejoin work, a round end move prompt lets you click a location.
- [ ] **Step 6: Commit** — `git commit -m "feat(ui): hand-offs, peeking, play flow, prompts, log and rules panel"`

---

### Task 10: Playtest, smoke test and polish

**Files:**
- Create: `playwright.config.ts` (webServer `npm run dev`, viewport 1366×768), `e2e/smoke.spec.ts`
- Modify: whatever the playtest exposes (most likely `boardGeometry.ts` values and `styles.css`)

**Interfaces:**
- Consumes: the whole app. Produces nothing new.

- [ ] **Step 1:** Install `@playwright/test` (dev) and `npx playwright install chromium`. Add script `e2e: playwright test`.
- [ ] **Step 2: Write `smoke.spec.ts`** — `it('starts a 4-player game and plays the setup round')`: load `/`, click New game → 4 players → Start; for each of 4 seats click the hand-off banner, click the first enabled card, confirm; expect the log to contain "plays" or the turn banner for the starting player; take screenshots `test-results/table-1366.png` and, at 1920×1080, `table-1920.png`; assert no element with `data-face="up"` exists while a hand-off banner is shown.
- [ ] **Step 3:** `npx playwright test` — PASS. Open both screenshots with the Read tool; tune `boardGeometry.ts` so tokens sit inside their locations, the pile sits in the open ground between the castles, deck/discard sit in the board's boxes.
- [ ] **Step 4: Manual playtest** with `npm run dev`: a full 4-player game and a full 3-player game; use the browser console helper `window.__debugGive(seat, cardName)` (dev-only, guarded by `import.meta.env.DEV`) to put each of the 19 special cards into a hand and play it once. Record anything wrong; fix and re-run `npx vitest run`.
- [ ] **Step 5:** `npm run build` — success; `npm run preview` loads the built game.
- [ ] **Step 6: Commit** — `git commit -m "test: smoke test, playtest fixes and board alignment"`
