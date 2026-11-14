# Escape from Wonderland: Animations and Board Info, Design

Date: 2026-11-15
Status: Approved in chat ("add all of them")

## Why

The game is played over voice, often with the tab half-watched. Players want to *see* what just
happened: who played which special card, whose turn it is, where cards went, who escaped. They also
want each board area to explain itself on hover.

## What gets animated

None of these animations block play: they ignore the pointer and never wait for input. They never
reveal a card that the viewer could not already see. Opponents' drawn and passed cards fly face down.

| # | Moment | What you see | How the game notices it |
|---|---|---|---|
| 1 | Action/Event played | The card flies to the board's centre, grows with a spin and gold glow, and bursts into ~18 sparkles. The caption reads "Sam plays Exile". Lasts 1.5 s. Several specials queue one after another. | New log line "X plays <special title>." |
| 2 | Turn changes | **Online:** a big sweeping banner, "Your turn" or "Sam's turn", 1.3 s. **One screen:** the existing hand-off banner gets the same big animated text instead (my call). | `current` changes during play (online) |
| 3 | Round ends | A banner: "Round 3 over — Round 4 begins · Kim starts" ("Round 1 · Sam goes first" after setup). | `round` goes up |
| 4 | Cards drawn | Card backs fly from the deck box to the drawer's hand or panel, staggered 120 ms apart. | Log lines "X draws N card(s)." and "The Jabberwocky makes X draw a card." |
| 5 | Starting picks | A face-down card appears in the pile area for each player who has picked, labelled with their name. When the last pick arrives, the revealed cards flip over. | Setup-pick prompts remaining; phase leaves `setup` |
| 6 | Win | The winner's Alice token flies up off the board through a sparkle burst under "<Name> escapes Wonderland!". The end screen appears after 2.5 s. | Phase becomes `game-over` |
| 7 | Discards | Discarded cards fly from the player's hand to the discard pile. At round end, the pile sweeps into the discard pile. | Log "X discards …" (one card per listed name); round goes up while the pile had cards |
| 8 | Hands change | **Mad Hatter's Party:** a face-down card slides from every panel to the next one on its right. **Vines:** a face-down card flies each way between the two players. **Caterpillar:** the two plates pulse with a gold link between them. | Log "Hands pass to the right." / "X and Y swap a card." / "X and Y look at each other's hands." |
| 9 | Slaying | "Slain: Jabberwocky" slashes across the effects panel and fades. | Log "X slays <title>." |
| 10 | Passing | A "DOWN" stamp lands on the player's plate. Down players' plates stay lowered and dimmed until the round ends. | Log "X passes." |

**Reduced motion:** when the system asks for reduced motion, flights and particles are switched off,
and banners and announcements become short fades.

## Board info on hover

Pointing at a location (using the traced masks) shows a small panel near the pointer with:
- the location name,
- its effect ("Number cards you play count 1 less"),
- the Events that can be played there ("Events here: Mad Hatter's Party, Tea of Confusion"),
- a note when Shadow Creatures has switched location effects off.

The panel is hidden while dragging a card.

## Structure

- `src/ui/animationEvents.ts`, all pure and unit-tested:
  - `newLogLines(prevLog, nextLog)` handles the 200-line cap.
  - `detectAnimations(prev, next): Anim[]`
  - `pickedSeats(state)`
  - `locationInfo(state, loc)`
- `src/ui/components/Animations.tsx` renders a queue of `Anim` on the stage. It uses CSS keyframes with
  per-element CSS variables for flight start and end.
- Anchor points:
  - deck box, discard box, pile, board centre (from `boardGeometry` + `BOARD_BOX`);
  - each seat's hand or panel centre (from `EDGE_BOXES`, or from the opponent panel centres online).
- `App` keeps showing the table for 2.5 s after game over (for the win animation), then the end screen.

## Testing

- Unit tests for each `detectAnimations` kind, `newLogLines` (including after the cap), `pickedSeats`
  and `locationInfo`.
- e2e: the existing 8 tests still pass. Add one test that sees the face-down setup cards appear and
  then flip, and one that sees the location hover panel.
- Screenshots of a special-card announcement, a draw flight and the turn banner, read and checked.
