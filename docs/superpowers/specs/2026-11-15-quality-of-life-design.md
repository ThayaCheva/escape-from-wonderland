# Escape from Wonderland: Quality-of-Life Pass, Design

Date: 2026-11-15
Status: Approved in chat ("do the whole lot")
Builds on: the rules spec and the online spec. Rules (§5) are unchanged.

## Why

Playtest screenshots showed friction on every turn:
- Cards too small to read.
- Plays that are easy to miss.
- Location and active effects you have to remember.
- Opponent panels that look broken apart.

The owner also asked for three things:
- Hover to preview a card.
- Drag a card onto the board to play it.
- Starting tokens in the open ground between the castles, and location outlines that match the board's shapes.

## The changes

| # | Change | Decision |
|---|---|---|
| 1 | **Bigger own hand online** | The viewer's own cards are 100×140 (was 75×105). Hot-seat is unchanged. |
| 2 | **Hover preview** | Pointing at any face-up card in your hand shows it at 300×420 just above the hand, rotated toward the owner in hot-seat. It hides when the pointer leaves. |
| 3 | **Drag to play** | Press on a face-up card in your hand and move more than 6 px, and a ghost card follows the pointer while the board glows. **During setup-pick**, dropping on the board picks the card. **On your turn** (or during a Drink Me extra), dropping plays the card if `checkPlay` allows it; otherwise the reason shows as a toast and the card snaps back. A press without movement is a click, which keeps the existing preview with **Play**. The drop target is the whole board. While you drag an Event card, its location glows. |
| 4 | **Last-play callout** | When the pile, active cards or discard change because someone played a card, a callout near the pile reads "Sam played Red 12 (counts as 13)" for 4 s. The newest pile card plays a short "pop" animation. Built from the newest log line containing " plays ". |
| 5 | **Bigger log** | The corner log grows to 15 px text, 7 visible lines, with the newest line highlighted. |
| 6 | **Locations on plates** | Every plate shows where that player is ("At the Mad Hatter's Place"). Your own plate (online), or the acting player's plate (hot-seat), adds the effect: "Your numbers count 1 less", "No Action cards here", "Numbers ignore colour", "Events don't affect you". Under Shadow Creatures it reads "Location effects are off". |
| 7 | **Active effects in words** | A panel in the board's top-left corner lists each active card in words, e.g. "Numbers must be Red (Dead Red Knight, Sam)", "Everyone draws 1 each turn (Jabberwocky)", "Location effects off (Shadow Creatures, Kim)", "Kim is immune (Cheshire Cat)", "Tweedledee is waiting for a partner". For Vorpal Sword these rows become the click targets, which replaces the mini-card row. |
| 8 | **Compact opponent panels (online)** | Each opponent is one upright panel: portrait, name, card count, a small fan of backs (up to 8 drawn, then "+N"), location, and status chips. Panels sit on the left, top and right as now. Hot-seat keeps its rotated strips. |
| 9 | **Play again** | After a game ends online, the host sees **Play again**: a new game with the same seats, a fresh deal, and the same room and link. Everyone else sees "Waiting for the host…" plus **Leave**. Protocol: `{ t: 'rematch' }` (host only, game over only). |
| 10 | **Traced location outlines** | The asset script traces each of the five coloured regions from the board art into a mask (`public/assets/locations/<id>.png`). Highlighting fills the mask with gold and adds a glow along its real edge. Clicks hit-test against the masks, so there is no overlap. Hit-testing is the pure function `locationAt(masks, x, y)`. |
| 11 | **Start in the open ground** | The Outskirts token slots move into the open ground between the castles (around 50 %, 66 %), where the owner circled. **The pile moves down onto the board's title strip** (around 50 %, 85 %) with smaller pile cards (70×98). This is my call: it's the only open space left, and it covers part of the title lettering. |
| 12 | **Pass confirmation** | If you press **Pass** while holding a legal card, the button changes to "Pass anyway?" for 3 s and needs a second click. With no legal card, one click passes. Pure helper: `hasLegalPlay(state, seat)`. |
| 13 | **Connection awareness** | The server pings every socket every 20 s and drops sockets that don't answer, so a sleeping laptop shows as disconnected. In the browser, a slim "Reconnecting…" bar shows while your own connection is down. |
| 14 | **Next player** | The next seat in turn order gets a "Next" chip on its plate. |
| 15 | **No join-screen flash on reload** | When the page opens with `?room=` and a stored seat, it shows "Reconnecting…" instead of the join form. |
| 16 | **Optional turn sound** | A short WebAudio chime when it becomes your move online. It's **off by default**, with a bell toggle in the top-right corner, remembered in `localStorage`. |

## Testing

- **Unit tests** for the pure helpers: `locationAt`, `hasLegalPlay`, `activeEffectLines`, `locationLine`, `lastPlayLine`, and `nextSeatToAct` for the "Next" chip.
- **Server tests** for rematch (host only, game over only, same seats, fresh hands) and for the heartbeat dropping a silent socket.
- **Asset check**: a contact image overlaying the traced outlines on the board, which I read and confirm.
- **e2e**: the existing 5 tests keep passing. Add one online test that drags a playable card onto the board and sees it on the pile, and one that plays a game to the end and starts a rematch. Use bot moves and a dev-only shortcut to end the game quickly.
- **Screenshots** of an online mid-game screen, a location-choice screen and a drag in progress, read and checked.
