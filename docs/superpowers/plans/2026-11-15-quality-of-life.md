# Quality-of-Life Pass, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship the 16 changes in `docs/superpowers/specs/2026-11-15-quality-of-life-design.md`.

**Architecture:** Pure helpers live in `src/ui/info.ts` (game facts shown on screen) and `src/ui/locationMasks.ts` (hit-testing). The server gains rematch and heartbeat. React components consume the helpers. The asset script gains location tracing.

**Spec:** `docs/superpowers/specs/2026-11-15-quality-of-life-design.md`

## Global Constraints
- Rules are unchanged. The engine changes only if a helper genuinely belongs there.
- Hot-seat privacy rules (`visibility.ts`) still decide every face-up card. The preview, drag and callout never show a card the viewer couldn't already see.
- All existing unit tests (145) and e2e tests (5) keep passing.

## Review Focus
1. **Drag never plays a card the viewer may not play.** That means no drag on someone else's turn, during a hand-off, or from a hidden card. Test: e2e drag plus a unit test of the drop decision.
2. **Rematch can't be triggered mid-game or by a guest.** Test: server unit tests.
3. **Traced masks cover the right regions with no overlap.** Test: a contact image check plus a `locationAt` unit test on a real mask sample.
4. **The heartbeat doesn't drop healthy browsers.** Test: the e2e online game still passes; a server test drops only a silent socket.
5. **Pass confirmation never blocks a forced pass.** Test: `hasLegalPlay` unit test.

### Task 1: Server: rematch and heartbeat
- Rematch: `ClientMsg` adds `{ t: 'rematch' }`. In `RoomManager`, if the sender is host and `room.game.phase === 'game-over'`, start a new game with the same seats and `endedAt = null`, then broadcast views.
- Heartbeat: `startServer` takes `heartbeatMs` (default 20000). Each socket is marked alive on `pong`. On each tick, a socket not alive since the last tick is terminated; otherwise it is pinged.
- Tests in `rooms.test.ts`:
  - a guest rematch is ignored;
  - a rematch mid-game is ignored;
  - a host rematch after game over brings back setup-pick prompts with the same names.
- Tests in `server.test.ts`: with `heartbeatMs: 100`, a raw TCP socket that never answers pings is closed within 500 ms.
- Commit: `feat(server): rematch and connection heartbeat`

### Task 2: Info helpers (`src/ui/info.ts`), test-first
- `hasLegalPlay(state, seat): boolean`: true if any card in the hand passes `checkPlay`.
- `activeEffectLines(state): Array<{ index: number; text: string; slayable: boolean }>`, worded as in spec #7.
- `locationLine(state, seat, withEffect: boolean): string`: e.g. "At the Mad Hatter's Place — numbers ignore colour". "In the Outskirts" has no effect. Under Shadow Creatures (when `locationEffectsOn` is false) the effect text is "location effects are off".
- `lastPlayLine(log: string[]): string | null`: the newest line containing " plays ", rewritten to past tense ("Sam played Red 12 (…)").
- `nextSeatToAct(state): Seat`: `nextSeat(state, state.current)`.
- Commit: `feat(ui): on-screen game facts helpers`

### Task 3: Traced location masks and the board
- `tools/crop_assets.py --locations`:
  1. On the board downscaled to 1238 px wide, mark pixels whose colour distance from parchment `(236,232,225)` is above 28.
  2. Open the mask (3×3 min then max) to cut thin pen lines.
  3. Flood-fill from a seed per location: white-queen (36,70), mad-hatter (37,40), black-forest (50,18), chess (63,35), red-queen (64,70), in percent.
  4. Fill holes and dilate by 1 px.
  5. Save as an RGBA PNG (white, with alpha = mask) in `public/assets/locations/<id>.png`.
  6. Write a contact overlay to `scratch/locations.png`.
- `src/ui/locationMasks.ts`:
  - `type Mask = { width; height; alpha: Uint8ClampedArray }`
  - `locationAt(masks: Partial<Record<LocationId, Mask>>, xPct: number, yPct: number): LocationId | null`. Pixels with alpha above 127 count.
  - `loadMasks(): Promise<Record<LocationId, Mask>>`, via an offscreen canvas.
  - Test with synthetic masks.
- Board:
  - The highlight overlay is a div per selectable location, using CSS `mask-image` and a gold background, inside a wrapper with `filter: drop-shadow(...)`.
  - Clicks on the board call `locationAt`.
  - Event-card drag highlight uses the same overlay.
  - Outskirts slots move to around (50, 66); the pile moves to (50, 85) at 70×98; the active-row is replaced by the effects panel.
- Commit: `feat(ui): traced location outlines, open-ground start, pile on the title strip`

### Task 4: Hand UX (bigger online hand, hover preview, drag to play, pass confirmation)
- `Card` size `hand-lg` is 100×140.
- `Hand` gets `onHover(card | null)` and `onDragPlay(card, overBoard: boolean)` via pointer events, with a 6 px threshold and a ghost in a `position: fixed` layer.
- `Table` decides what a drop does through `dropAction(state, seat, cardId, prompt) → { action } | { reason }`, a pure function in `info.ts`, with unit tests:
  - setup-pick → pick (number cards only);
  - your turn → play via `checkPlay`;
  - Drink Me extra → free play;
  - anything else → reason "You can't play a card right now."
- Pass confirmation uses `hasLegalPlay`.
- Commit: `feat(ui): hover preview, drag to play, bigger hand, pass confirmation`

### Task 5: Info UX (callout, log, plates, effects panel, compact opponents, next chip)
- Wire the Task 2 helpers into the components.
- `OpponentPanel` component for online.
- Commit: `feat(ui): last-play callout, effects panel, locations on plates, compact opponents`

### Task 6: Online polish and verification
- Reconnecting bar: the hook exposes `socketOpen`.
- Reload with a stored seat shows "Reconnecting…".
- Play again UI on the online end screen.
- Sound toggle and chime.
- e2e: drag-to-play test; game end and rematch test, using dev-only `window.__debugEnd()` that asks the server… (no). Instead, play bots until game over, or cap at 400 moves and skip the rematch check if the game hasn't ended. Otherwise, test rematch at the room level only.
- Screenshots read: mid-game, location choice, drag in progress, rematch screen.
- Commit: `feat(ui): reconnect bar, play again, turn chime; e2e for drag and rematch`
