# Escape from Wonderland — Digital Table Edition: Design

Date: 2026-11-14
Status: Draft for approval

## 1. Intent

The owner designed *Escape from Wonderland*, a 3–4 player card-shedding game with a
board, and has finished art for it (cards, board, tokens, rule book). They want to play
it **at home with friends around one computer**: one screen, one mouse passed around,
each player sitting on one side of the screen. It's for personal use, not a submission
or a product.

The game should feel like the physical game: the board in the middle, each player's
hand on their own edge facing them and face down, the owner's art everywhere. The
computer's job is to **enforce the rules and do the bookkeeping** (turn order, who has
passed, who played the last number card, location effects, multi-step card effects),
so nobody has to argue about or remember rules.

## 2. Goals, non-goals, anti-goals

**Goals**
- A complete, playable game of 3 or 4 players on one screen, played with a mouse.
- Every rule and card effect enforced. Illegal moves are impossible. Legal moves are
  obvious.
- Hands stay secret on a shared screen: face down by default, revealed only when their
  owner clicks to peek.
- The owner's art is used throughout.
- Runs in a modern desktop browser, with no server and no install for players.

**Non-goals (not in this version)**
- Play across separate devices or networks, accounts, matchmaking.
- Computer opponents.
- Touch or mobile layouts.
- Sound and music.
- Undo.

**Anti-goals (would count as failure even if it technically works)**
- Hands leak: a card face is shown on screen when its owner didn't ask to see it, or
  someone else's private choice is visible.
- The game silently makes a rules call the players can't see. Every automatic effect
  is announced in the game log.
- Tiny or hover-only controls. One shared mouse means every action is a clear click.
- Placeholder art left in place where the owner's art exists.

## 3. Constraints

- **Hardware:** one landscape monitor (assume 1366×768 or larger), one mouse, players
  seated around it: bottom, left, top, right.
- **Assets:** the owner's files in
  `C:\Users\Jerry\Desktop\Stuff\Stuff\Boring Documents\Education\University\Game Design\`.
  Card art comes as A4 print sheets (2492×3508 px, a 3×3 grid of cards per sheet).
  Individual cards must be cropped out. Use the `new_*` sheets for Action and Event
  cards. They are the current versions.
- **Rules source:** the owner's rule book (`rule_book_1.jpg`, `rule_book_2.jpg`,
  `locations.jpg`) plus the card texts. Section 5 restates them in full, with every
  gap filled. Where this document and the rule book disagree, this document wins,
  because it records the owner-approved rulings.

## 4. How it gets made (builder's choices, stated)

All of these are **my call** as the designer. The owner delegated technology choices.

- **Web app:** TypeScript, React, Vite. Static build, no backend. The owner runs it
  with `npm run dev`, or opens the built `dist/` from any static host later.
- **Rules engine separate from the UI:** a pure TypeScript module (`src/engine/`)
  holding the full game state and a `step(state, action) -> state` function. No React,
  no DOM, no randomness except through an injected seeded RNG. Unit tested with Vitest.
  The UI only renders state and sends actions.
- **Pending prompts:** multi-step effects (Drink Me's extra plays, Execution Order's
  declaration, every player choosing a discard for White Queen's Generosity, and so on)
  are modelled as a queue of *prompts* in the engine state. Each prompt names the
  player who must answer and what they may choose. The UI renders whatever prompt is at
  the front of the queue.
- **Auto-save:** the game state is saved to `localStorage` after every step. The title
  screen offers "Continue game" if a save exists. A page refresh must not lose a game.
- **Asset pipeline:** `tools/crop_assets.py` (Python with Pillow, both already
  installed) takes the asset folder as an argument. It crops each card from the sheets,
  crops the round tokens with a circular mask, downsizes the board, and writes
  everything to `public/assets/`. The cropped output is committed so the game runs
  without the source folder. Crop rectangles are hand-measured constants in the script.

## 5. The rules (complete)

### 5.1 Components

**Deck:** 142 cards. Deck composition lives in one config file so the owner can
change copy counts later.

- **Number cards (104):** Red 1–13 and White 1–13, **4 copies of each**. Red cards
  have the heart motif. White cards have the rook motif.
- **Action cards (18), marked "A":** **2 copies each** of Drink Me Potion, Eat Me
  Cake, Vorpal Sword, Cheshire Cat, Execution Order, Dead Red Knight, Dead White
  Knight, Wisdom of Caterpillar, Exile.
- **Event cards (20), marked "E"**, **2 copies each**, each tied to a location:
  - White Queen's Castle: White Queen's Generosity, Tweedledee, Tweedledum
  - Chess Battlefield: Jabberwocky
  - Mad Hatter's Place: Mad Hatter's Party, Tea of Confusion
  - Red Queen's Castle: Rabbit Hole, Red Queen's Decree
  - Black Forest: Shadow Creatures, Vines of the Black Forest

Because there are duplicate copies, the rulings in 5.5 also say what happens when two
copies of the same card are active at once.

**Board locations**, in clockwise order around the arc:
White Queen's Castle → Mad Hatter's Place → Black Forest → Chess Battlefield →
Red Queen's Castle → (back to White Queen's Castle).
The open ground in the middle of the board, the **Outskirts**, is not a location.

**Location effects** apply only to the player standing there:

| Location | Effect on the player standing there |
|---|---|
| White Queen's Castle | Number cards they play count as **−1** |
| Red Queen's Castle | Number cards they play count as **+1** |
| Black Forest | They **cannot play Action cards** |
| Mad Hatter's Place | Their number cards **ignore the colour rule** |
| Chess Battlefield | They are **immune to the effects of Event cards** |

**Tokens:** four Alice tokens (gold, rose, blue and mint hair). The +1/−1 tokens are
shown as badges on modified number cards in the pile.

### 5.2 Setup

1. Shuffle the deck and deal 7 cards to each player. All Alices start in the Outskirts.
2. **Starting player:** each player in turn privately chooses one number card from
   their hand (pass-the-mouse flow, section 6.4). Once everyone has chosen, all choices
   are revealed together.
   - The lowest printed value goes first. If two cards have the same value, Red counts
     as lower than White. If two players chose the exact same card, the game picks
     randomly between them and says so in the log.
   - A player with no number card in hand chooses nothing and can't go first. If no
     player has a number card, reshuffle and redeal. With 104 number cards in 142,
     this is practically impossible.
3. The revealed cards **are in play immediately.** They are stacked on the pile from
   lowest to highest, so the highest revealed card is the top card to beat. The player
   who revealed the highest card counts as the "last player to play a number card."
4. There is no draw at the start of the first round. Every later round starts with a
   draw (5.6).

### 5.3 Turns

Play goes clockwise: bottom → left → top → right (3 players: bottom → left → right).

On your turn, do **exactly one** of these:

- **Play a number card.** It is legal if both of these hold:
  - **Value:** its *effective value* (printed value ±1 for your location, see 5.4) is
    **equal to or higher than** the top card's recorded value. Anything is allowed on
    an empty pile.
  - **Colour:** it is the **other colour** from the top card. Exceptions:
    - At Mad Hatter's Place, colour doesn't matter.
    - While a Dead Knight is active, the card must be the Knight's colour instead
      (5.5). Mad Hatter's Place and Cheshire Cat immunity override this, as the
      table in 5.5 explains.
- **Play an Action card.** You can't do this while standing in the Black Forest
  (unless Shadow Creatures is active).
- **Play an Event card.** Your Alice must be on the card's location.
- **Pass.** Your hand goes face down (you're "down"). You may pass even if you have a
  legal play.

**Being down and rejoining:** a down player still gets their turn. On it, they may
**rejoin** by playing any legal card, which turns their hand face up again, or **stay
down**, which works the same as passing. (The rule book's "jump back in at any time
after one rotation" becomes "on your turn," because the next chance to act is always one
rotation later.) Down players are still affected by card effects like everyone else,
and they stay down afterwards.

Action and Event cards go to the discard pile once their effect finishes. They never
become the top card of the pile. Cards with a lasting effect (marked "lasting" in 5.5)
sit in an **active cards** area by the pile until their effect ends, then go to the
discard pile.

### 5.4 Effective values

- The effective value is the printed value, −1 at White Queen's Castle, +1 at Red
  Queen's Castle, based on **where the player stands when they play the card**. Shadow
  Creatures switches this off.
- The pile records the card's **effective value at the moment it was played** and
  shows a +1/−1 badge on it. Later location changes don't change it.
- Effective values can be 0 (White 1 at the White Queen's Castle) or 14 (Red 13 at the
  Red Queen's Castle).
- Eat Me Cake uses **printed** values.

### 5.5 Card rulings

"Immune" players are **not affected by and cannot be chosen as targets of** the
effects listed. There are two sources of immunity:
- **Chess Battlefield:** immune to Event card effects, including events the player
  plays themselves. Switched off by Shadow Creatures.
- **Cheshire Cat:** immune to effects of cards played by other players.

**Action cards**

| Card | Ruling |
|---|---|
| **Drink Me Potion** | After it resolves, you may play **up to 2 more cards** from your hand, one at a time, during this turn. Number cards played this way go on top **ignoring value and colour**. Their effective value still applies and is recorded, and you count as the last player to play a number card. Action and Event cards played this way still need their usual conditions (Black Forest ban, correct location). On **your next turn**, you may only play number cards or pass. |
| **Eat Me Cake** | Discard any number cards from your hand whose **printed** values add up to 5 or less. Zero cards is allowed. |
| **Vorpal Sword** | Choose one active card: Jabberwocky, Shadow Creatures, Dead Red Knight, Dead White Knight, or a waiting Tweedle. Its effect ends and both it and the Sword go to the discard pile. **Only playable if there is a valid target.** It can't slay Cheshire Cat, which is immune to other players' cards. |
| **Cheshire Cat** *(lasting)* | Until the round ends, you are immune to every effect of cards played by other players. That includes being chosen by Vines, Caterpillar, Exile or Execution Order, all "every player" effects, Jabberwocky draws, Dead Knight colour locks, and Shadow Creatures (your location effect keeps working). It doesn't protect you from your own cards. **Only one Cheshire Cat can be active per round:** once one has been played this round, the second copy can't be played until the next round. |
| **Execution Order** | Declare a **number value from 1 to 13** (either colour counts). Leaving colour out makes the card a real gamble: the next player holds a match roughly 40% of the time, compared with about 20% if a colour had to be named too. The "next player" is the next player clockwise who is not down. The game checks their hand automatically, so nobody has to be trusted. **If they hold a number card of that printed value**, it is played onto the pile for them **right away**, ignoring value and colour, using their effective value. They become the last player to play a number card, **they skip their next turn**, and **you draw 5**. If they hold two, they choose which. **If they don't hold one**, they **draw 5** and then take their next turn normally. If the next player is immune (Cheshire Cat), the card has no effect. |
| **Dead Red Knight** *(lasting)* | Until the round ends, or until it's slain, every number card played must be **Red**. This replaces the alternate-colour rule; the value rule still applies. You draw 1 card. If a Dead White Knight is played later, the newer Knight replaces it. Players at Mad Hatter's Place ignore the lock, because colour doesn't matter there. A Cheshire-immune player ignores a lock that another player set and uses the normal alternate-colour rule. |
| **Dead White Knight** *(lasting)* | Same as Dead Red Knight, but **White**. |
| **Wisdom of Caterpillar** | Choose another player who isn't immune. Privately, you see their hand, then they see yours (pass-the-mouse flow, 6.4). Nothing else changes. |
| **Exile** | Choose any player, including yourself, but not a Cheshire-immune opponent. Move their Alice to a **different location** (any of the 5; the Outskirts isn't an option). The moved player draws 1 card. |

**Event cards**

| Card (location) | Ruling |
|---|---|
| **White Queen's Generosity** (White Queen's Castle) | Starting with you and going clockwise, every non-immune player who has cards privately chooses 1 card and discards it. |
| **Tweedledee / Tweedledum** (White Queen's Castle) *(lasting while waiting)* | If the partner card isn't active, the played card **waits** in the active area along with who played it. When the partner is played in the **same round** (by anyone standing at White Queen's Castle), each of the two players who played them **may discard up to 2 cards** of their choice. If one player played both cards, they may discard up to 4. A newly played Tweedle pairs with the **earliest** waiting partner. A Tweedle whose partner isn't waiting just waits as well, so two Tweedledees can wait at the same time. If the round ends with cards still waiting, they're discarded with no effect. Chess immunity doesn't apply, because only the players who played the cards are affected. |
| **Jabberwocky** (Chess Battlefield) *(lasting)* | Until slain or until the round ends, **every non-immune player draws 1 card at the start of each of their turns**, including turns where they are down. The player who played it stands on Chess Battlefield, so they are immune. **Two active Jabberwockies stack**, so players draw 2 per turn. Vorpal Sword slays one at a time. |
| **Mad Hatter's Party** (Mad Hatter's Place) | Every non-immune player passes their whole hand to the next non-immune player on their **right**. Seated around the table facing the centre, your right is counter-clockwise, which is the *previous* player in turn order. Immune players keep their hands and are skipped. |
| **Tea of Confusion** (Mad Hatter's Place) | Starting with you and going clockwise, every non-immune player privately discards 0, 1 or 2 cards, then draws 2. |
| **Rabbit Hole** (Red Queen's Castle) | Every non-immune player who is on a location moves one step clockwise (Red Queen's Castle wraps around to White Queen's Castle). Players in the Outskirts don't move. The player who played it moves too. |
| **Red Queen's Decree** (Red Queen's Castle) | Every non-immune player draws 1 card, including the player who played it. |
| **Shadow Creatures** (Black Forest) *(lasting)* | Until the round ends, or until it's slain, **all location effects are switched off** for everyone: the ±1 values, the Black Forest Action ban, Mad Hatter's colour freedom, and Chess immunity. The location requirement for playing Event cards still applies. If the player who played it **leaves the Black Forest** for any reason, the card goes to the discard pile immediately and its effect ends. If two copies are active, location effects stay off while **either** one remains. Each copy is tied to its own player. |
| **Vines of the Black Forest** (Black Forest) | Choose another non-immune player. Click one of their **face-down** cards without seeing it, then choose a card from your own hand to give them in exchange. |

**The general "PLAY" and "DISCARD" rules** from the rule book apply as written:
- A number card that a card effect *plays* goes on top regardless of value and colour.
- A card that an effect *discards* goes straight to the discard pile.

### 5.6 End of a round

- **When:** right after a pass leaves exactly one player not down.
- **Then, in order:**
  1. The **last player to play a number card** this round may move their Alice to any
     of the 5 locations, or stay where they are. If no number card was played this
     round, nobody moves. If that player is the one who played
     Shadow Creatures and they leave the Black Forest, the card goes to the discard
     pile, which makes no difference because step 2 clears it anyway.
  2. The pile and all active cards go to the discard pile. Every "until the round
     ends" effect stops. Drink Me's "next turn" restriction carries over if that next
     turn falls in the new round.
  3. Every player draws 1 card, starting with the player who will start the round and
     going clockwise.
  4. The player who **wasn't down** starts the new round. Any number card can open the
     empty pile. Everyone's hand is face up again (nobody is down).

### 5.7 Winning

- **When the game checks:** after every complete step, meaning a card played together
  with its whole effect, or a draw. It never checks partway through an effect. For
  example, a player who discards to zero cards during Tea of Confusion and then draws
  2 hasn't won.
- **Who wins:** a player with **0 cards** escapes Wonderland and wins immediately. If
  two or more reach 0 in the same step, the winner is the first of them in clockwise
  order, starting with the player whose card caused the step.

### 5.8 Running out of cards

- When someone must draw and the deck is empty, shuffle the discard pile (not the play
  pile and not the active cards) to form a new deck.
- If both are empty, the draw is skipped.

## 6. The screen

### 6.1 Layout

- The background is `background.jpg`, the dark navy and gold frame.
- The board art fills the centre. On the board:
  - The **draw deck** sits in the board's "Card Deck" box.
  - The **discard pile** (top card visible) sits in the "Discard Pile" box.
  - The **play pile** and the **active cards** row sit in the open space at the bottom
    centre, between the two castles.
- Each player owns one screen edge: seat 1 bottom, seat 2 left, seat 3 top, seat 4
  right. Their hand fans along that edge, **rotated to face them**. Next to it is a
  **player plate** showing their Alice portrait, card count, and status (active turn,
  down, immune, Drink Me restriction).
- The current player's edge glows. Their action buttons (Peek, Pass / Stay down)
  appear on their plate, rotated to face them.
- Alice tokens stand on the board. Each location has 4 fixed slots so tokens never
  overlap. The Outskirts has 4 slots too.
- The **game log** is a small scrolling strip that announces every play, effect and
  automatic ruling in plain words, for example: "Rose plays Red 9 (Red Queen's Castle:
  counts as 10)." It never names a card that is still hidden.
- A **Rules** button opens a scrollable panel with section 5 written for players.
- Hands can grow large (Execution Order draws 5), so the fan compresses its spacing.
  Card size stays readable when peeked.

### 6.2 Hidden hands

- All hands are always face down, with a card-back design. The owner has no card-back
  art, so I'll draw one from `card.png`'s border ornaments in the navy and gold of the
  rule book cover, as a placeholder the owner can replace.
- On your turn, **click Peek** to flip your own hand face up. Click again to flip it
  back. It always flips back automatically when your turn ends or a hand-off begins.
- While peeked, legal cards are clearly marked and illegal cards are dimmed, with a
  one-line reason shown when clicked, such as "Must be White and at least 9."
- Clicking a card selects it and shows it enlarged with a **Play** button. Nothing is
  played on a single misclick.

### 6.3 Turn hand-off

Between turns, a full-width banner says "**Mint Alice's turn** — click to begin." This
gives the mouse time to move round the table. No hand is visible during the hand-off.

### 6.4 Private choices by players other than the current one

Some effects need private input from other players: setup picks, White Queen's
Generosity, Tea of Confusion, Tweedle discards, Caterpillar viewing, and Execution
Order when the next player holds two matching cards. Each uses the same flow:

1. A banner asks: "**Pass the mouse to Blue Alice.** Everyone else look away. Click when
   ready."
2. Blue's hand flips face up on Blue's edge, with the prompt ("Choose 1 card to
   discard").
3. Blue confirms, and the hand flips back face down.
4. Repeat for the next player who needs to choose.

For Caterpillar, step 2 shows the *other* player's hand on the viewer's edge.

### 6.5 Choosing targets

- **Players:** click their plate. Only valid targets are highlighted.
- **Locations:** click the location on the board. Each location has a hit area traced
  roughly over its art shape.
- **Values** (Execution Order): a row of 13 buttons.
- **Optional choices** (Drink Me, Eat Me, Tweedle, Tea, round-end move) always have an
  explicit "Done" or "Stay here" button.

### 6.6 Title, game setup and end screens

- **Title:** `title.jpg` with **New game** and **Continue game** (only if a save
  exists).
- **New game:** choose 3 or 4 players. Seats are fixed to Alices: seat 1 gold, 2 rose,
  3 blue, 4 mint. With 3 players, the top seat is empty. Optional name entry for each
  seat (defaults: "Gold Alice" and so on).
- **End:** "<Name> escaped Wonderland!" with that player's Alice, plus **New game**.

## 7. Testing

- **Engine unit tests (Vitest)** cover every rule in section 5:
  - number legality, including location modifiers, Mad Hatter's Place, Knight locks
    and immunity combinations
  - pass, rejoin and round-end detection
  - round-end move, cleanup, draws and the next starting player
  - setup tie-break and highest-on-top stacking
  - every Action and Event card's ruling, including the edge cases written in 5.5
  - win detection, including simultaneous zeros
  - deck reshuffle
- Tests use a seeded RNG and hand-built states, so they don't depend on shuffle luck.
- **Manual playtest** in a browser at 1366×768 and at 1920×1080:
  - a full 4-player game and a full 3-player game
  - every card played at least once
  - a check that no card face appears outside a peek or a private hand-off step

## 8. Left to the builder

- Exact visual styling (fonts, sizes, animations) within the look of the owner's art.
  The rule book uses a serif body face and a decorative "Wonderland" heading face, so
  pick free web fonts close to those.
- Crop coordinates, the token slot positions on the board, and location hit areas.
- Internal engine structure and state shape, provided the engine stays pure and
  testable as described in section 4.
- Wording of log lines and prompts, as long as it stays plain and short.
