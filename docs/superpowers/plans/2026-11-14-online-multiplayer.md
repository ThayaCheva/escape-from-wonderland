# Escape from Wonderland — Online Multiplayer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let 2–4 friends play from their own PCs through private rooms on a free Render server, while keeping the one-screen mode and adding a 2-player variant.

**Architecture:** A Node server (`server/`) holds every room's `GameState`, runs the existing pure engine `step()` for each action, and sends each player only `viewFor(state, seat)`, a redacted copy. The React client gains a WebSocket hook, title/entry/lobby screens, and a "viewer seat" mode for the existing `Table` (own hand always face up, viewer at the bottom, no hand-offs).

**Tech Stack:** existing (TypeScript 6, React 19, Vite 8, Vitest 5, Playwright 1.65) + `ws` 8.23 and `tsx` 4.23 (runtime dependency, so Render can run the TypeScript server directly).

**Spec:** `docs/superpowers/specs/2026-11-14-online-multiplayer-design.md`. The rules spec `docs/superpowers/specs/2026-11-14-escape-wonderland-design.md` §5 is unchanged and still binding.

## Global Constraints

- The engine (`src/engine/**`) stays pure: no Node, DOM, `Math.random` or `Date`.
- Player count is `2 | 3 | 4` everywhere.
- The server never sends a hidden card's real `id`, any deck card, or the seed (spec §4).
- One process serves the static `dist/`, `GET /health` → `200 ok`, and WebSocket path `/ws`, all on `process.env.PORT` (default 8080).
- The client connects to `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`.
- Room codes: 4 letters from `ABCDEFGHJKLMNPQRSTUVWXYZ`. Token storage key: `escape-wonderland/token/<ROOM>`.
- Lobby errors: "No room with that code.", "That room is full.", "That game has already started."
- The existing 112 unit tests and the one-screen e2e tests keep passing.

## Review Focus

1. **A hidden card leaks into a view** through any field: another hand, deck, seed, setup picks, `vines-give.takenCardId`, or a real card id in a placeholder. Test: a JSON string-search over `viewFor` output for every hidden id, in Task 2, plus the same check in the online e2e (Task 6).
2. **Reconnect mid-prompt:** a player reloads while a prompt is waiting for them, and must get the prompt back. Test: an e2e reload during the game, in Task 6.
3. **A stale or second tab** acting for a seat. The newer connection replaces the older one, and an action from the replaced socket is ignored. Test: a rooms test in Task 3.
4. **The host leaves the lobby.** Host passes to the next seat, and a lobby with 0 players is deleted. Test: rooms tests in Task 3.
5. **The 2-player edge cases:** a round ending on a single pass, and Mad Hatter's Party swapping hands. Test: engine tests in Task 1.

---

### Task 1: 2-player support (engine + one-screen UI)

**Files:** Modify `src/engine/setup.ts`, `src/engine/testkit.ts`, `src/ui/components/NewGameScreen.tsx`, `src/ui/components/RulesPanel.tsx`, `src/ui/useGame.ts` (type); tests `src/engine/__tests__/setup.test.ts`, `flow.test.ts`, `events.test.ts`, `fuzz.test.ts`.

**Interfaces:** `newGame(opts: { playerCount: 2 | 3 | 4; names?: string[]; seed: number })`; with 2 players, edges are `['bottom','top']` and alices `['gold','blue']`. `StartOptions.playerCount: 2 | 3 | 4`.

- [ ] **Step 1: Failing tests.**
  - `newGame({playerCount:2, seed:7})`: edges `bottom,top`, alices `gold,blue`, deck 128.
  - 2 players, seat 0 plays, seat 1 passes: round ends, with a move prompt for seat 0.
  - `mh-party` with 2 players swaps the two hands.
  - Fuzz test: `playerCount` cycles `[2,3,4][seed % 3]`.
- [ ] **Step 2:** Run. Expect FAIL. **Step 3:** Implement: add a 2-player option to the NewGameScreen seats list (Gold bottom, Blue top), and add a line to the rules panel: "2 players is a variant: a round ends as soon as either player passes." **Step 4:** Run all. Expect PASS.
- [ ] **Step 5: Commit:** `feat: 2-player variant`

### Task 2: `viewFor` and shared protocol types

**Files:** Create `src/engine/view.ts`, `src/net/protocol.ts`; test `src/engine/__tests__/view.test.ts`.

**Interfaces:**
- `viewFor(state: GameState, seat: Seat): GameState` returns a deep copy where:
  - every other player's hand card becomes `{ id: \`hidden-${owner}-${i}\`, kind: 'hidden' }`, typed as `HiddenCard` and cast;
  - deck cards become `{ id: \`hidden-deck-${i}\`, kind: 'hidden' }`;
  - `seed: 0`;
  - `setupPicks` keeps only the viewer's own entry while `phase === 'setup'`;
  - a `vines-give` prompt whose `seat !== seat` gets `takenCardId: ''`;
  - if `prompts[0]` is `view-hand` with `seat === viewer`, the target's real hand is kept.
- `export interface HiddenCard { id: string; kind: 'hidden' }` (in `view.ts`). `isHidden(card: { kind: string }): boolean`.
- `protocol.ts`:
  - `ClientMsg`: the union of `create | join | resume | start | action | ping`, as spec §5.
  - `ServerMsg`: the union of `joined | lobby | view | error | replaced`, where `replaced` is `{ t: 'replaced' }`, sent to a tab that was taken over.
  - `LobbyPlayer = { name: string; alice: AliceColor; connected: boolean }`.

- [ ] **Step 1: Failing tests.**
  - With a 4-player mid-game state, for each viewer: `JSON.stringify(viewFor(s, v))` contains no id from the other hands or the deck, and contains every id of the viewer's own hand.
  - Hand counts and deck length are kept. Seed is 0.
  - Setup phase: another player's pick is absent, and your own pick is present.
  - `vines-give` for seat 1: viewer 0 sees `takenCardId ''`, viewer 1 sees the real id.
  - `view-hand {seat:1,target:3}`: viewer 1 sees seat 3's real hand; viewer 2 does not.
  - The input state is unchanged (deep-equal to a clone taken beforehand).
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5: Commit:** `feat(engine): per-seat redacted views and protocol types`

### Task 3: Room manager (pure, no network)

**Files:** Create `server/rooms.ts`; test `server/__tests__/rooms.test.ts`. Modify `vite.config.ts` (`test.include` adds `server/**/*.test.ts`) and `tsconfig.json` (`include` adds `server`).

**Interfaces:**
- `interface Conn { id: string; send(msg: ServerMsg): void }`
- `class RoomManager`:
  - `constructor(opts: { now: () => number; randomInt: (max: number) => number })`
  - `handle(conn: Conn, msg: ClientMsg): void`
  - `disconnect(conn: Conn): void`
  - `sweep(): void` deletes expired rooms; the server calls it every 60 s.
  - `roomCount(): number`
- Room state: `{ code, phase: 'lobby'|'game', seats: Array<{ name; token; conn: Conn | null }>, hostSeat, game: GameState | null, emptySince: number | null, endedAt: number | null }`.
- Behaviour (spec §4–§5):
  - `create` makes a unique code and seats the creator. It sends `joined`, then `lobby`.
  - `join` checks, in order: unknown room, then started, then full (4). It trims and caps the name at 16 characters; a blank name becomes the Alice name of that seat (seat order gold, rose, blue, mint for 4 players). Alice assignment at start uses `newGame` (2 players: gold/blue; 3: gold/rose/mint).
  - `start` is host-only and needs 2–4 seats. It calls `newGame({playerCount, names, seed: randomInt(2**31)})` and broadcasts views.
  - `action` comes only from the seat's current conn. `action.seat` must equal that seat (else ignored). It calls `step`. On `IllegalActionError` it sends `error` to the sender only; on success it broadcasts views.
  - `resume` takes `room` and `token`. The token must match a seat. Any old conn for that seat gets `{t:'replaced'}` and is detached. In the lobby it re-sends `lobby`; in a game it sends `view`.
  - `disconnect` in the lobby removes the seat. If that was the host, the host becomes seat 0 of the remaining seats; an empty lobby room is deleted. In a game it marks `conn = null` and broadcasts views (the `connected` array changes).
  - `ping` does nothing.
  - Views are broadcast as `{ t:'view', view: viewFor(game, seat), seat, connected }` to each attached conn.
  - Expiry: a game room with every conn null expires after 30 min. A room whose game phase is `game-over` expires 10 min after the game ended.

- [ ] **Step 1: Failing tests** (fake `Conn` that records sent messages; fake clock):
  - create → `joined` with seat 0 and a 4-letter code, then `lobby` listing 1 player.
  - join unknown → "No room with that code."; a 5th join → "That room is full."; join after start → "That game has already started."
  - a non-host start is ignored; host start with 1 player → error "Need at least 2 players."; host start with 2 → both get `view`, and each view hides the other's hand ids.
  - an action for another seat is ignored (no broadcast); an illegal action → `error` to the sender only; a legal action → everyone gets a new view.
  - resume with the right token from a new conn: the old conn gets `replaced`, the new conn gets `view`, and actions from the old conn are ignored (Review Focus 3). A wrong token → error "Couldn't rejoin that room."
  - the host disconnects in the lobby → the next player is host; the last player disconnects → `roomCount()` 0 (Review Focus 4).
  - a disconnect mid-game → the others get a view with `connected[seat] === false`.
  - sweep: an all-disconnected game room is removed after 30 min, but not after 29.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5: Commit:** `feat(server): room manager`

### Task 4: Server entry point

**Files:** Create `server/index.ts`, `server/__tests__/server.test.ts`. Modify `package.json` (dependencies `ws`, `tsx`; dev `@types/ws`; script `start: tsx server/index.ts`).

**Interfaces:** `startServer(opts: { port: number; distDir: string }): Promise<{ port: number; close(): Promise<void> }>`. The file runs `startServer({ port: Number(process.env.PORT ?? 8080), distDir: 'dist' })` only when executed directly.
- HTTP: `GET /health` → `200 ok`. Other paths serve files from `distDir`, with `/` → `index.html`, unknown non-file paths → `index.html`, and content types for html/js/css/jpg/png/woff/woff2/svg. Requests containing `..` → 404.
- WebSocket on path `/ws`. Each socket is a `Conn`; JSON-parse each message (bad JSON is ignored). `close` → `manager.disconnect`. Sweep runs every 60 s.

- [ ] **Step 1: Failing test:** start on port 0 with a temp `distDir` containing `index.html`. Check:
  - `/health` → `ok`; `/` → the html; `/../package.json` → 404.
  - Two `ws` clients: A creates, B joins, A starts. Both receive `view`, and B's view has no id of A's hand.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5: Commit:** `feat(server): http + websocket server`

### Task 5: Online client (hook, screens, viewer-seat table)

**Files:** Create `src/net/useOnlineGame.ts`, `src/ui/components/OnlineEntryScreen.tsx`, `src/ui/components/LobbyScreen.tsx`; modify `src/ui/App.tsx`, `TitleScreen.tsx`, `Table.tsx`, `PlayerEdge.tsx`, `Card.tsx`, `layout.ts`; test `src/ui/__tests__/layout.test.ts`.

**Interfaces:**
- `layout.ts`: `edgeFor(seat: Seat, viewer: Seat, count: number): Edge`. The offset `(seat - viewer + count) % count` indexes the list for that count: 2 → `[bottom, top]`; 3 → `[bottom, left, right]`; 4 → `[bottom, left, top, right]`.
- `useOnlineGame()` returns:
  - `{ status: 'idle'|'connecting'|'lobby'|'game'|'replaced', room, seat, lobby: { players: LobbyPlayer[]; hostSeat } | null, view: GameState | null, connected: boolean[], error: string | null }`;
  - methods `create(name)`, `join(room, name)`, `start()`, `act(action): void`, `leave()`.

  It reconnects with backoff (1 s, 2 s, 4 s, max 8 s). On (re)connect, if a token exists for the room, it sends `resume`. It pings every 25 s. When a view arrives with `actingSeat(view) === seat`, it sets `document.title` to "Your turn — Escape from Wonderland", otherwise "Escape from Wonderland". If the page opens with `?room=CODE`, it prefills Join.
- `Table` gets optional props `viewerSeat?: Seat` and `connected?: boolean[]`. When `viewerSeat` is set:
  - no hand-off or peek;
  - the viewer's hand is always face up;
  - edges come from `edgeFor`, and plates/hands are not rotated (`PlayerEdge` props `edge?: Edge`, `upright?: boolean`);
  - prompt and controls render only when `actingSeat === viewerSeat`;
  - otherwise a banner reads "Waiting for <name>…", or "Waiting for <name> to reconnect…" when `connected[acting] === false`;
  - a "Disconnected" chip is shown on plates.
- `Card` renders the back for any card whose `kind === 'hidden'`, even when asked for face up.
- `PlayerEdge` gets the attribute `data-viewer="true"` on the viewer's own edge in online mode, and `"false"` on the others (the e2e leak check uses it).
- Title buttons: **Create online room**, **Join room**, **Play on one screen** (the existing flow).
- `OnlineEntryScreen`: name field, plus a code field in join mode. `LobbyScreen`: big code, **Copy link** (`navigator.clipboard.writeText(location.origin + '/?room=' + code)`), player list with portraits, **Start game** (host, 2–4 players), and "Waiting for the host to start…" for everyone else.

- [ ] **Step 1: Failing tests:** `edgeFor(2,0,4)` = `'top'`, `edgeFor(0,1,4)` = `'right'`, `edgeFor(1,0,2)` = `'top'`, `edgeFor(2,1,3)` = `'left'`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS, plus `tsc --noEmit`.
- [ ] **Step 5:** Run the server locally (`npm run build && npm start`). Open 3 Playwright pages, then create, join and start. Screenshot each player's screen and read them: own hand face up, others face down, correct seats, waiting banner.
- [ ] **Step 6: Commit:** `feat(ui): online rooms, lobby and per-player table`

### Task 6: Online e2e, deployment files

**Files:** Create `e2e/online.spec.ts`, `render.yaml`, `DEPLOY.md`; modify `playwright.config.ts` (webServer `npm run build && npx tsx server/index.ts` with `PORT=5190`, baseURL `http://localhost:5190`; the hot-seat tests run against it too).

- [ ] **Step 1: Write `online.spec.ts`:**
  - `it('3 players play 150 random moves online without seeing each other's cards')`: 3 browser contexts; create, join ×2, start. Loop: the page whose screen shows its own prompt or turn makes a random legal move, using the same moves as `smoke.spec.ts`. After each move, on every page, check that no `.player-edge[data-viewer="false"] [data-face="up"]` exists unless a Caterpillar view panel is open. At move 60, reload one page and expect it back in its seat with the same card count (Review Focus 2). Check no page errors.
  - `it('2 players can play a round online')`: create, join, start, then play until the round number reaches 2 or 60 moves have passed.
- [ ] **Step 2:** `npx playwright test`. Expect all pass.
- [ ] **Step 3:** Write `render.yaml`:
  ```yaml
  services:
    - type: web
      name: escape-from-wonderland
      runtime: node
      plan: free
      buildCommand: npm ci && npm run build
      startCommand: npm start
      healthCheckPath: /health
  ```
  Write `DEPLOY.md` with numbered steps:
  1. Create an empty GitHub repo.
  2. `git remote add origin …` then `git push -u origin <branch>:main`.
  3. Sign in at render.com with GitHub.
  4. New → Blueprint, pick the repo, then Apply.
  5. Wait for "Live".
  6. Open the `onrender.com` URL and share it.

  Add notes on the about one minute wake-up and on games being lost if the server restarts.
- [ ] **Step 4:** `npm run build && npx vitest run && npx playwright test`. Expect all green.
- [ ] **Step 5: Commit:** `feat: online e2e tests and Render deployment`
