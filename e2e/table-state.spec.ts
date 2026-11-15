import { expect, test, type Page, type WebSocketRoute } from '@playwright/test';
import { step } from '../src/engine/step';
import { makeState, num, pileOf } from '../src/engine/testkit';
import type { GameState } from '../src/engine/types';
import { viewFor } from '../src/engine/view';
import type { ClientMsg, ServerMsg } from '../src/net/protocol';

const players = () => [
  { name: 'Alice', hand: [num('W', 7), num('W', 5)] },
  { name: 'Lily', hand: [num('R', 8), num('W', 6)] },
  { name: 'Edith', hand: [num('R', 9)] },
];

// Hold the resume reply until the test explicitly sends a new game view.
async function onlineTable(page: Page, initial: GameState) {
  let connection: WebSocketRoute;
  const actions: ClientMsg[] = [];
  let resumes = 0;
  const send = (message: ServerMsg) => connection.send(JSON.stringify(message));
  const view = (state: GameState) => send({
    t: 'view', view: viewFor(state, 0), seat: 0, connected: [true, true, true], hostSeat: 0,
  });
  await page.routeWebSocket('**/ws', (socket) => {
    connection = socket;
    socket.onMessage((data) => {
      const message = JSON.parse(String(data)) as ClientMsg;
      if (message.t === 'create') {
        send({ t: 'joined', room: 'TEST', seat: 0, token: 'test-seat' });
        view(initial);
      } else if (message.t === 'resume') {
        resumes++;
      } else if (message.t === 'action') {
        actions.push(message);
      }
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create online room' }).click();
  await page.locator('input').first().fill('Alice');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByTestId('board')).toBeVisible();
  return { view, actions, resumes: () => resumes, disconnect: () => connection.close() };
}

test('automatic passing waits for a resumed view and restarts after reconnect', async ({ page }) => {
  await page.clock.install();
  const state = makeState({ players: players(), pile: [pileOf(num('R', 13), 1)] });
  const room = await onlineTable(page, state);
  await expect(page.getByTestId('no-play')).toBeVisible();
  await room.disconnect();
  await expect(page.getByTestId('offline')).toBeVisible();
  await page.clock.runFor(1200);
  await expect.poll(room.resumes).toBe(1);
  await page.clock.runFor(2400);
  expect(room.actions).toEqual([]);
  await expect(page.getByTestId('offline')).toBeVisible();

  room.view(state);
  await expect(page.getByTestId('no-play')).toBeVisible();
  await page.clock.runFor(2400);
  await expect.poll(() => room.actions).toEqual([{ t: 'action', action: { type: 'pass', seat: 0 } }]);
});

test('Rules contains keyboard focus and restores it on Escape', async ({ page }) => {
  await onlineTable(page, makeState({ players: players() }));
  const rules = page.getByRole('button', { name: 'Rules' });
  await rules.click();
  const dialog = page.getByRole('dialog', { name: 'How to play' });
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  for (const key of ['Tab', 'Tab', 'Shift+Tab', 'Shift+Tab']) {
    await page.keyboard.press(key);
    await expect(dialog.locator(':focus')).toHaveCount(1);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(rules).toBeFocused();
});

test('a read-only card preview stays open as play passes between opponents', async ({ page }) => {
  const state = makeState({ players: players(), current: 1 });
  const room = await onlineTable(page, state);
  await page.locator('[data-viewer="true"]').getByRole('button', { name: 'White 7' }).click({ position: { x: 6, y: 30 } });
  const preview = page.getByRole('dialog', { name: 'White 7' });
  await expect(preview).toBeVisible();
  const next = step(state, { type: 'play', seat: 1, cardId: state.players[1].hand[0].id });
  room.view(next);
  await expect(page.getByTestId('waiting')).toContainText('Edith');
  await expect(preview).toBeVisible();
  await expect(preview.getByRole('button')).toHaveCount(1);
});

test('activity stays on the same visible entry as the capped log advances', async ({ page }) => {
  const state = makeState({ players: players(), current: 1 });
  state.log = Array.from({ length: 200 }, (_, i) => `Chronological entry ${i + 1}.`);
  const room = await onlineTable(page, state);
  const log = page.getByTestId('log');
  await log.evaluate((el) => { el.scrollTop = 120; });
  const topEntry = () => log.evaluate((el) => {
    const top = el.getBoundingClientRect().top;
    return Array.from(el.children).find((row) => row.getBoundingClientRect().bottom > top)?.textContent;
  });
  const reading = await topEntry();
  expect(reading).toMatch(/^Chronological entry 16[3-8]\.$/);
  const next = step(state, { type: 'play', seat: 1, cardId: state.players[1].hand[0].id });
  room.view(next);
  await expect(log.getByText('Lily plays Red 8.')).toBeAttached();
  await expect.poll(topEntry).toBe(reading);
});
