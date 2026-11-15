import { useEffect, useId, useRef, type RefObject } from 'react';
import { CARD_DEFS } from '../../engine/cards';

const CARD_RULES: Array<[string, string]> = [
  ['Drink Me Potion', 'Play up to 2 more cards right away. Number cards played this way ignore value and colour. On your next turn you may only play number cards (or pass). Drink Me can’t be one of the extra cards.'],
  ['Eat Me Cake', 'Discard any number cards from your hand whose printed values add up to 5 or less.'],
  ['Vorpal Sword', 'Slay one active card (Jabberwocky, Shadow Creatures, a Dead Knight or a waiting Tweedle). Only playable when there is something to slay. Can’t slay the Cheshire Cat.'],
  ['Cheshire Cat', 'Until the round ends, nothing other players play affects you or can target you. Only one Cheshire Cat per round.'],
  ['Execution Order', CARD_DEFS['execution-order'].text],
  ['Dead Red / White Knight', 'Until the round ends, number cards must be that colour (instead of alternating). A newer Knight replaces an older one. You draw 1.'],
  ['Wisdom of Caterpillar', 'Choose a player. You see their hand, then they see yours.'],
  ['Exile', 'Move any player (you too) to a different location. They draw 1.'],
  ["White Queen's Generosity", 'Everyone discards 1 card of their choice.'],
  ['Tweedledee & Tweedledum', 'One waits until the other is played in the same round. Then both players may discard up to 2 cards (up to 4 if one player played both).'],
  ['Jabberwocky', 'Until slain or the round ends, everyone draws 1 card at the start of each of their turns. Two Jabberwockies stack.'],
  ["Mad Hatter's Party", 'Everyone passes their whole hand to the player on their right (the player before them in turn order).'],
  ['Tea of Confusion', 'Everyone discards up to 2 cards, then draws 2.'],
  ['Rabbit Hole', 'Everyone on a location moves one location clockwise.'],
  ["Red Queen's Decree", 'Everyone draws 1 card.'],
  ['Shadow Creatures', 'Until the round ends, all location effects are off. Discarded at once if its player leaves the Black Forest.'],
  ['Vines of the Black Forest', 'Take a face-down card from another player, then give them a card from your hand.'],
];

export function RulesPanel({ onClose, returnFocus }: { onClose: () => void; returnFocus: RefObject<HTMLButtonElement | null> }) {
  const titleId = useId();
  const body = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    return () => returnFocus.current?.focus();
  }, [returnFocus]);

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="panel rules"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Tab') {
            e.preventDefault();
            (e.target === close.current ? body : close).current?.focus();
          }
        }}
      >
        <h1 id={titleId}>How to play</h1>
        <div className="rules-body" ref={body} tabIndex={0}>
          <h2>Goal</h2>
          <p>Escape Wonderland by being the first player with no cards left.</p>
          <h2>Setup</h2>
          <p>
            Everyone gets 7 cards and starts in the Outskirts. Each player secretly picks a number card; the lowest goes
            first (Red beats White on a tie). The picked cards start the pile — the highest is the card to beat.
          </p>
          <h2>Your turn</h2>
          <p>Do one thing:</p>
          <ul>
            <li>
              <b>Number card</b> — equal or higher than the top card, and the other colour.
            </li>
            <li>
              <b>Action card</b> — not while you’re in the Black Forest.
            </li>
            <li>
              <b>Event card</b> — only when your Alice is on the card’s location.
            </li>
            <li>
              <b>Pass</b> — your hand goes down. On a later turn you can rejoin by playing a card.
            </li>
          </ul>
          <h2>Locations</h2>
          <ul>
            <li>White Queen’s Castle: your number cards count 1 less.</li>
            <li>Red Queen’s Castle: your number cards count 1 more.</li>
            <li>Black Forest: you can’t play Action cards.</li>
            <li>Mad Hatter’s Place: your number cards ignore the colour rule.</li>
            <li>Chess Battlefield: Event cards don’t affect you.</li>
          </ul>
          <h2>End of a round</h2>
          <p>
            When everyone but one player is down, the round ends. The last player to play a number card may move their
            Alice to any location. The pile and active cards are cleared, everyone draws 1, and the player still standing
            starts the next round.
          </p>
          <h2>2 players (variant)</h2>
          <p>The official game is for 3–4 players. With 2, everything works the same, but a round ends as soon as either player passes.</p>
          <h2>Cards</h2>
          <dl>
            {CARD_RULES.map(([name, text]) => (
              <div key={name} className="rule-card">
                <dt>{name}</dt>
                <dd>{text}</dd>
              </div>
            ))}
          </dl>
        </div>
        <button className="btn" ref={close} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
