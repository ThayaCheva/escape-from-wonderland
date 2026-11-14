# Escape from Wonderland — Online Multiplayer: Design

Date: 2026-11-14
Status: Draft for approval
Builds on: `2026-11-14-escape-wonderland-design.md` (the rules spec, §5, is unchanged and still binding)

## 1. Intent

The owner and their friends want to play *Escape from Wonderland* **from their own homes,
each on their own PC**, while talking over Discord or a call. Today the game only works
with everyone around one screen. The online version must keep every rule, card ruling and
piece of art. The owner only changes **where people sit**: one person creates a room,
pastes a link in Discord, and friends join from their browsers.

## 2. Goals, non-goals, anti-goals

**Goals**
- Private rooms that 2–4 players join with a short code or link, then the host starts the game.
- Each player sees their own hand face up and everyone else's face down, on their own screen.
- **Real privacy:** the server never sends a browser any card that player isn't allowed
  to see, so nobody can cheat by poking at the browser.
- A player whose browser closes or refreshes gets their seat back automatically.
- Free hosting on Render, deployed from a GitHub repo, with no credit card.

**Non-goals**
- Accounts, friends lists, matchmaking with strangers, rankings.
- In-game chat or voice. Players are on Discord.
- Phones and tablets. This version is PC with mouse only, as before.
- Spectators, turn timers, kicking players.
- Keeping games through a server restart (see §3).

**Anti-goals**
- A hidden card reaches a browser that shouldn't have it. This includes another hand,
  deck order, the RNG seed, and the cards behind Vines or Caterpillar.
- A player gets stuck with no way forward because someone else disconnected and nothing
  says so.
- The rules behave differently online than on one screen.

## 3. Constraints

- **Hosting:** Render free web service. It sleeps after about 15 minutes with no traffic,
  and the first visit afterwards takes about a minute to wake it. It has no persistent
  disk, so games live in server memory, and a restart or sleep loses rooms that are in
  progress. While a game is open, browsers send a heartbeat every 25 s, so an active game
  keeps the server awake. The game should be finished in one sitting.
- **Repo:** the project isn't on GitHub yet. The owner creates a GitHub repo, pushes to
  it, and connects it on Render. I'll give exact step-by-step instructions, but the
  account steps are the owner's to do.
- **Everything the existing spec requires about rules (§5) still applies.**

## 4. How it gets made (my calls)

- **One Node service** serves both the built web page and the live game connection
  (WebSocket, via the `ws` library) on the same address. No separate frontend host.
- **The server is authoritative.** It holds each room's `GameState` and runs the existing
  pure engine (`step`) for every action. Browsers send *actions*; the server replies with
  a *view*.
- **`viewFor(state, seat)`** is a new pure engine function. It returns a copy that is
  safe to send to one player:
  - Other players' hands become face-down placeholders. The count stays; the cards are
    gone.
  - The deck becomes a count only, and the seed is removed.
  - A front `view-hand` prompt *for this viewer* keeps the target's real hand. This is
    Caterpillar.
  - **Card ids give cards away** (`R7-2` is a Red 7). Placeholders therefore get fresh
    meaningless ids (`hidden-<seat>-<index>`), and no hidden card's real id may appear
    anywhere in the view.
  - `setupPicks` only shows the viewer's own pick until setup resolves.
  - Prompt fields that name a hidden card are removed for everyone except the prompt's
    own player. Today that is only `vines-give.takenCardId`.
  - Everything else (pile, discard, active cards, positions, log, the remaining prompt
    fields) is public already.
- **The seed for each new game** comes from `crypto.randomInt` on the server.
- **Rooms:** 4-letter codes (letters only, no look-alikes such as I/O), e.g. `KQTX`. The
  link `https://<app>.onrender.com/?room=KQTX` opens straight into joining.
- **Seats:** the order people join is the turn order. The host is seat 1 (Gold Alice),
  then Rose, Blue and Mint. With 3 players, Blue is left out, as in the one-screen game.
  With 2 players it's Gold and Blue, sitting opposite each other.
- **2-player variant (owner-approved):** the game supports **2–4 players**, both online
  and on one screen. The rules are unchanged. With 2, a round ends as soon as either
  player passes, and every "another player" card targets the opponent. In the engine,
  `playerCount` becomes `2 | 3 | 4`; a 2-player one-screen game sits players at bottom
  and top. The random-play fuzz test must include 2-player games. The rulebook's "3–4"
  stays as the official count; the in-game rules panel calls 2 players a variant.
- **Reconnecting:** on joining, the server gives the browser a secret seat token, stored
  in `localStorage` for that room. Reopening the link with the token takes you back to
  your seat. If the same seat connects from a second tab, the newer connection replaces
  the older one, which is told "Opened in another tab."
- **In the lobby**, before the game starts, a player who disconnects is removed from the
  lobby. They can join again. If the host leaves, the next player in seat order becomes
  host. Once the game has started, seats are kept for reconnecting.
- **Names** are trimmed and capped at 16 characters. A blank name becomes the Alice
  name ("Rose Alice").
- **The one-screen mode stays.** The title screen offers **Create online room**, **Join
  room**, and **Play on one screen**. The existing hot-seat game keeps working unchanged.
  My call: it's already built and costs nothing to keep.

## 5. Protocol

All messages are JSON over one WebSocket.

**Browser → server**

| Message | Meaning |
|---|---|
| `{ t: 'create', name }` | Make a room. The sender becomes the host and seat 0. |
| `{ t: 'join', room, name }` | Join a room in its lobby. |
| `{ t: 'resume', room, token }` | Take back your seat after a reconnect. |
| `{ t: 'start' }` | Host only, with 2–4 players in the lobby: deal and begin. |
| `{ t: 'action', action: GameAction }` | A game move. The server checks that `action.seat` is the sender's seat. |
| `{ t: 'ping' }` | Heartbeat every 25 s. |

**Server → browser**

| Message | Meaning |
|---|---|
| `{ t: 'joined', room, seat, token }` | You're in. Store the token. |
| `{ t: 'lobby', room, players: [{ name, alice, connected }], hostSeat }` | Lobby state, sent to everyone on any change. |
| `{ t: 'view', view: GameView, seat, connected: boolean[] }` | Your safe view of the game, sent to every player after every change. |
| `{ t: 'error', message }` | Illegal move, unknown room, room full, game already started, and so on. |

- The server **ignores** actions for another seat and rejects illegal ones with `error`.
  The engine's `IllegalActionError` message becomes the error text.
- Rooms are deleted 30 minutes after their last player disconnects, or 10 minutes after
  a game ends.
- Join errors use player-facing text:
  - "No room with that code."
  - "That room is full."
  - "That game has already started."

## 6. The online screen

- **You always sit at the bottom.** The other players are placed clockwise from you:
  - 4 players: left, top, right.
  - 3 players: left, right.
  - 2 players: top.

  Turn order on the board still matches the room's seat order.
- **Your hand is face up all the time.** There's no Peek button and no hand-off screen.
  Legal cards look normal and illegal ones are dimmed. Clicking a card shows the same
  preview with **Play** or the reason it can't be played.
- **Other players' plates and hands are upright**, not rotated. You're the only one
  looking at your screen.
- **When someone else must act**, their plate glows and a small banner says "Waiting for
  Rose…" (with what they're choosing when it's a prompt, e.g. "Rose is choosing a card
  to discard").
- **Your prompts** appear in the same prompt panel as before, upright and near your hand.
  This covers discard, Execution Order, Vines, choosing a location, and the rest.
- **Disconnected players** get a "Disconnected" chip on their plate. When it's their turn,
  everyone else sees "Waiting for Rose to reconnect…". Nothing breaks, and the game
  resumes when they return.
- **Lobby screen:** the room code shown big, a **Copy link** button, the joined players
  with their Alice portraits, and **Start game** for the host, enabled at 2–4 players.
  Everyone else sees "Waiting for the host to start…".
- **The end screen** is the same as now, plus **Back to title**.
- **Sound for "your turn"**: the browser tab title changes to "Your turn — Escape from
  Wonderland" when it's your move, so a player who has tabbed out to Discord notices.
  There's no audio, which keeps the original "no sound" non-goal.

## 7. Deployment

- `render.yaml` in the repo describes one free web service:
  - build: `npm ci && npm run build`
  - start: `node server/dist/index.js` (or `npx tsx server/index.ts`, builder's choice)
  - health check: `/health`
- The server listens on `process.env.PORT`.
- A `DEPLOY.md` walks the owner through it step by step:
  1. Create the GitHub repo.
  2. Push to it.
  3. Sign in to Render with GitHub.
  4. Click **New → Blueprint** and pick the repo.
  5. Wait for the build.
  6. Share the URL.

## 8. Testing

- **Engine:** `viewFor` unit tests. They check that:
  - no other hand's cards, deck card or seed appear anywhere in the JSON (a
    string-search for every hidden card id);
  - another player's setup pick and Vines' `takenCardId` are hidden;
  - Caterpillar reveals the target's hand to the viewer only;
  - counts are kept.
- **Server:** room logic tests run in memory, with no network:
  - create, join, room full, join after start, start with too few players (fewer than 2)
  - host-only start
  - actions for another seat ignored
  - resume with the token, and a wrong token rejected
  - views redacted for every seat
  - room cleanup timers (with fake timers)
- **End-to-end (Playwright):** start the real server locally, open 3 browser contexts (and a
  second run with 2),
  create and join a room, start, and play random legal moves through each player's own
  screen for 150 moves. Check:
  - no page errors;
  - no face-up cards outside each player's own hand (or a Caterpillar view);
  - reloading one player's page mid-game puts them back in their seat.
- **The existing 112 unit tests and the one-screen e2e tests must still pass.**
- **Manual check after deploy:** the owner (or I, if given the URL) opens the Render link
  in two browsers and plays a round.

## 9. Left to the builder

- The exact message type definitions (shared TypeScript types between server and client),
  folder layout (`server/`), and how the server is compiled or run.
- Visual details of the lobby and waiting banner, within the existing look.
- Reconnect backoff timing in the browser.
