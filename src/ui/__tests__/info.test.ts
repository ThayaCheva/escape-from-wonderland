import { describe, expect, it } from 'vitest';
import { activeEffectLines, dropAction, hasLegalPlay, lastPlayLine, lastPlayedCard, locationLine, nextSeatToAct } from '../info';
import { makeState, num, pileOf, sp } from '../../engine/testkit';

describe('hasLegalPlay', () => {
  it('is true only when some card in hand can be played', () => {
    const s = makeState({ players: [{ hand: [num('W', 3), num('W', 12)] }, {}, {}], pile: [pileOf(num('W', 9), 1)] });
    expect(hasLegalPlay(s, 0)).toBe(false);
    s.players[0].hand.push(num('R', 10));
    expect(hasLegalPlay(s, 0)).toBe(true);
  });
});

describe('activeEffectLines', () => {
  it('describes each active card in words, and only Cheshire Cat is not slayable', () => {
    const s = makeState({
      players: [{ name: 'Ann' }, { name: 'Sam' }, { name: 'Kim' }],
      active: [
        { card: sp('dead-red-knight'), seat: 1 },
        { card: sp('jabberwocky'), seat: 2 },
        { card: sp('shadow-creatures'), seat: 0 },
        { card: sp('cheshire-cat'), seat: 2 },
        { card: sp('tweedledee'), seat: 1 },
      ],
    });
    expect(activeEffectLines(s)).toEqual([
      { index: 0, text: 'Numbers must be Red (Dead Red Knight, Sam)', slayable: true },
      { index: 1, text: 'Everyone draws 1 card each turn (Jabberwocky, Kim)', slayable: true },
      { index: 2, text: 'Location effects are off (Shadow Creatures, Ann)', slayable: true },
      { index: 3, text: "Kim is immune to other players' cards (Cheshire Cat)", slayable: false },
      { index: 4, text: 'Tweedledee is waiting for Tweedledum (Sam)', slayable: true },
    ]);
  });
});

describe('locationLine', () => {
  it('names the location and, when asked, its effect', () => {
    const s = makeState({ players: [{ position: 'white-queen' }, { position: 'outskirts' }, { position: 'chess' }] });
    expect(locationLine(s, 0, false)).toBe("At the White Queen's Castle");
    expect(locationLine(s, 0, true)).toBe("At the White Queen's Castle — your numbers count 1 less");
    expect(locationLine(s, 1, true)).toBe('In the Outskirts');
    expect(locationLine(s, 2, true)).toBe("At the Chess Battlefield — Events don't affect you");
  });

  it('says when Shadow Creatures has switched effects off', () => {
    const s = makeState({ players: [{ position: 'red-queen' }, {}, {}], active: [{ card: sp('shadow-creatures'), seat: 1 }] });
    expect(locationLine(s, 0, true)).toBe("At the Red Queen's Castle — location effects are off");
  });
});

describe('lastPlayLine', () => {
  it('turns the newest play in the log into past tense', () => {
    expect(lastPlayLine(['Ann passes.', "Sam plays Red 12 (Red Queen's Castle: counts as 13).", 'Kim passes.'])).toBe(
      "Sam played Red 12 (Red Queen's Castle: counts as 13).",
    );
    expect(lastPlayLine(['Round 2 begins.'])).toBeNull();
  });
});

describe('lastPlayedCard', () => {
  it('recovers a played Event from an older save without using the discard pile', () => {
    const state = makeState({ players: [{ name: 'Ann' }, { name: 'Sam plays chess' }] });
    state.log = ['Sam plays chess plays Tweedledee.', 'Tweedledee waits for a partner.', 'Ann discards White 5.'];
    expect(lastPlayedCard(state)).toMatchObject({ seat: 1, card: { kind: 'event', name: 'tweedledee' } });
  });

  it('recognizes modified number plays in older saves', () => {
    const state = makeState({ players: [{ name: 'Ann' }, { name: 'Sam' }] });
    state.log = ["Sam plays Red 13 (Red Queen's Castle: counts as 14)."];
    expect(lastPlayedCard(state)).toMatchObject({ seat: 1, card: { kind: 'number', color: 'red', value: 13 } });
  });
});

describe('nextSeatToAct', () => {
  it('is the next seat clockwise from the current player', () => {
    expect(nextSeatToAct(makeState({ players: [{}, {}, {}], current: 2 }))).toBe(0);
  });
});

describe('dropAction', () => {
  it('during setup, dropping a number card picks it; other cards are refused', () => {
    const r3 = num('R', 3);
    const exile = sp('exile');
    const s = makeState({ players: [{ hand: [r3, exile] }, { hand: [num('R', 1)] }, { hand: [num('R', 2)] }] });
    s.phase = 'setup';
    s.prompts = [{ type: 'setup-pick', seat: 0 }];
    expect(dropAction(s, 0, r3.id)).toEqual({ action: { type: 'setup-pick', seat: 0, cardId: r3.id } });
    expect(dropAction(s, 0, exile.id)).toEqual({ reason: 'Choose a number card.' });
  });

  it('on your turn, a legal card plays and an illegal one gives the reason', () => {
    const r10 = num('R', 10);
    const w3 = num('W', 3);
    const s = makeState({ players: [{ hand: [r10, w3] }, {}, {}], pile: [pileOf(num('W', 9), 1)] });
    expect(dropAction(s, 0, r10.id)).toEqual({ action: { type: 'play', seat: 0, cardId: r10.id } });
    expect(dropAction(s, 0, w3.id)).toEqual({ reason: 'Must be Red and at least 9.' });
  });

  it("is refused on someone else's turn or while another prompt is waiting", () => {
    const r10 = num('R', 10);
    const s = makeState({ players: [{ hand: [r10] }, {}, {}], current: 1 });
    expect(dropAction(s, 0, r10.id)).toEqual({ reason: "You can't play a card right now." });
    const t = makeState({ players: [{ hand: [r10] }, {}, {}] });
    t.prompts = [{ type: 'eat-me', seat: 0 }];
    expect(dropAction(t, 0, r10.id)).toEqual({ reason: "You can't play a card right now." });
  });

  it('during Drink Me, any number card plays for free', () => {
    const w2 = num('W', 2);
    const s = makeState({ players: [{ hand: [w2, num('R', 1)] }, {}, {}], pile: [pileOf(num('W', 13), 1)] });
    s.prompts = [{ type: 'drink-me-extra', seat: 0, remaining: 2 }];
    expect(dropAction(s, 0, w2.id)).toEqual({ action: { type: 'play', seat: 0, cardId: w2.id } });
  });
});

describe('review fixes', () => {
  it('pass asks for confirmation only online or after peeking (never leaks a face-down hand)', async () => {
    const { passNeedsConfirm } = await import('../info');
    const s = makeState({ players: [{ hand: [num('R', 10)] }, {}, {}], pile: [pileOf(num('W', 9), 1)] });
    expect(passNeedsConfirm(s, 0, { online: true, peeked: false })).toBe(true);
    expect(passNeedsConfirm(s, 0, { online: false, peeked: false })).toBe(false);
    expect(passNeedsConfirm(s, 0, { online: false, peeked: true })).toBe(true);
    const none = makeState({ players: [{ hand: [num('W', 3)] }, {}, {}], pile: [pileOf(num('W', 9), 1)] });
    expect(passNeedsConfirm(none, 0, { online: true, peeked: true })).toBe(false);
  });

  it('the first play after the screen opens is announced, but not what was already there', async () => {
    const { changedSince } = await import('../info');
    expect(changedSince(undefined, 'Sam played Red 9.')).toBeNull(); // first render: nothing new
    expect(changedSince(null, 'Sam played Red 9.')).toBe('Sam played Red 9.'); // first play of a game / round
    expect(changedSince('Sam played Red 9.', 'Sam played Red 9.')).toBeNull();
    expect(changedSince('a', null)).toBeNull();
  });
});

describe('shouldAutoPass', () => {
  it('passes for a player whose turn it is and who has nothing they can play', async () => {
    const { shouldAutoPass } = await import('../info');
    const stuck = makeState({ players: [{ hand: [num('W', 3), num('W', 12)] }, {}, {}], pile: [pileOf(num('W', 9), 1)] });
    expect(shouldAutoPass(stuck, 0)).toBe(true);
    const canPlay = makeState({ players: [{ hand: [num('R', 10)] }, {}, {}], pile: [pileOf(num('W', 9), 1)] });
    expect(shouldAutoPass(canPlay, 0)).toBe(false);
  });

  it('never passes for someone else, during a prompt, after acting, or outside play', async () => {
    const { shouldAutoPass } = await import('../info');
    const s = makeState({ players: [{ hand: [num('W', 3)] }, {}, {}], pile: [pileOf(num('W', 9), 1)] });
    expect(shouldAutoPass(s, 1)).toBe(false);
    s.prompts = [{ type: 'eat-me', seat: 0 }];
    expect(shouldAutoPass(s, 0)).toBe(false);
    s.prompts = [];
    s.turnActionTaken = true;
    expect(shouldAutoPass(s, 0)).toBe(false);
    s.turnActionTaken = false;
    s.phase = 'game-over';
    expect(shouldAutoPass(s, 0)).toBe(false);
  });

  it('respects the Drink Me lock (a playable action does not count)', async () => {
    const { shouldAutoPass } = await import('../info');
    const s = makeState({ players: [{ hand: [sp('exile'), num('W', 3)], drinkMeLock: 'active' }, {}, {}], pile: [pileOf(num('W', 9), 1)] });
    expect(shouldAutoPass(s, 0)).toBe(true);
  });
});
