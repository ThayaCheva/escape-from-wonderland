import { expect, test, type Browser, type Page } from '@playwright/test';
import { randomMove } from './helpers';

async function openPlayers(browser: Browser, count: number) {
  const pages: Page[] = [];
  const errors: string[] = [];
  for (let i = 0; i < count; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`P${i}: ${e.message}`));
    pages.push(page);
  }
  const [host, ...guests] = pages;
  await host.goto('/');
  await host.getByRole('button', { name: 'Create online room' }).click();
  await host.locator('input').first().fill('Host');
  await host.getByRole('button', { name: 'Create' }).click();
  const code = (await host.getByTestId('room-code').innerText()).trim();
  for (const [i, g] of guests.entries()) {
    await g.goto(`/?room=${code}`);
    await g.locator('input').first().fill(`Guest${i + 1}`);
    await g.getByRole('button', { name: 'Join' }).click();
    await expect(g.getByText('Waiting for the host to start')).toBeVisible();
  }
  await host.getByRole('button', { name: 'Start game' }).click();
  for (const p of pages) await expect(p.locator('.player-edge[data-viewer="true"]')).toBeVisible();
  return { pages, errors };
}

async function expectPrivate(pages: Page[]) {
  for (const p of pages) await expect(p.locator('.player-edge[data-viewer="false"] [data-face="up"]')).toHaveCount(0);
}

/** One move by whichever screen must act. Returns false if no screen could act. */
async function moveSomewhere(pages: Page[]): Promise<boolean> {
  for (const p of pages) {
    if (await randomMove(p)) {
      await p.waitForTimeout(120);
      return true;
    }
  }
  return false;
}

const gameOver = async (pages: Page[]) => (await pages[0].getByText('escaped Wonderland').count()) > 0;

test('3 players play 150 random moves online without seeing hidden cards', async ({ browser }) => {
  const { pages, errors } = await openPlayers(browser, 3);
  let idle = 0;
  for (let move = 0; move < 150 && !(await gameOver(pages)); move++) {
    if (move === 60) {
      // a refresh mid-game puts the player back in their seat with the same hand
      const p = pages[1];
      const before = await p.locator('.player-edge[data-viewer="true"] .card').count();
      await p.reload();
      await expect(p.locator('.player-edge[data-viewer="true"]')).toBeVisible({ timeout: 15_000 });
      await expect(p.locator('.player-edge[data-viewer="true"] .card')).toHaveCount(before);
    }
    if (await moveSomewhere(pages)) idle = 0;
    else if (++idle > 20) throw new Error('no screen could act for 20 tries');
    await expectPrivate(pages);
  }
  expect(errors).toEqual([]);
});

test('2 players can play a round online', async ({ browser }) => {
  const { pages, errors } = await openPlayers(browser, 2);
  const round2 = async () => (await pages[0].getByTestId('log').getByText('Round 2 begins').count()) > 0;
  for (let move = 0; move < 80 && !(await gameOver(pages)) && !(await round2()); move++) {
    await moveSomewhere(pages);
    await expectPrivate(pages);
  }
  expect((await round2()) || (await gameOver(pages))).toBe(true);
  expect(errors).toEqual([]);
});

test('dragging a card from your hand onto the board plays it', async ({ browser }) => {
  const { pages, errors } = await openPlayers(browser, 2);
  const host = pages[0];
  // setup: the host chooses a starting card by dragging it onto the board
  const card = host.locator('.player-edge[data-viewer="true"] .card[data-face="up"]:not(.dimmed)').first();
  const box = (await card.boundingBox())!;
  const board = (await host.getByTestId('board').boundingBox())!;
  await host.mouse.move(box.x + 8, box.y + box.height / 2);
  await host.mouse.down();
  await host.mouse.move(board.x + board.width / 2, board.y + board.height / 2, { steps: 8 });
  await expect(host.locator('.drag-ghost')).toBeVisible();
  await host.mouse.up();
  await expect(host.getByTestId('waiting')).toContainText('choosing a starting card');
  expect(errors).toEqual([]);
});

test('the dragged card follows the pointer, and an interrupted drag is cancelled', async ({ browser }) => {
  const { pages, errors } = await openPlayers(browser, 2);
  const host = pages[0];
  const card = host.locator('.player-edge[data-viewer="true"] .card[data-face="up"]:not(.dimmed)').first();
  const box = (await card.boundingBox())!;
  const board = (await host.getByTestId('board').boundingBox())!;
  const target = { x: board.x + board.width * 0.7, y: board.y + board.height * 0.4 };
  await host.mouse.move(box.x + 8, box.y + box.height / 2);
  await host.mouse.down();
  await host.mouse.move(target.x, target.y, { steps: 8 });
  const ghost = (await host.locator('.drag-ghost').boundingBox())!;
  // the ghost is drawn around the pointer
  expect(Math.abs(ghost.x + ghost.width / 2 - target.x)).toBeLessThan(40);
  expect(Math.abs(ghost.y + ghost.height * 0.6 - target.y)).toBeLessThan(40);
  // switching away mid-drag cancels it; releasing afterwards plays nothing
  await host.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(host.locator('.drag-ghost')).toHaveCount(0);
  await host.mouse.up();
  await expect(host.getByTestId('prompt')).toContainText('starting card');
  expect(errors).toEqual([]);
});

test("your hand is greyed out while it isn't your move", async ({ browser }) => {
  const { pages, errors } = await openPlayers(browser, 2);
  const [host, guest] = pages;
  const guestCards = guest.locator('.player-edge[data-viewer="true"] .card[data-face="up"]');
  // the host chooses a starting card first, so every one of the guest's cards is grey
  await expect(guestCards).toHaveCount(7);
  await expect(guest.locator('.player-edge[data-viewer="true"] .card[data-face="up"]:not(.dimmed)')).toHaveCount(0);
  // and the host, who is choosing, has number cards lit up
  expect(await host.locator('.player-edge[data-viewer="true"] .card[data-face="up"]:not(.dimmed)').count()).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('starting picks wait face down on the board until everyone has chosen', async ({ browser }) => {
  const { pages, errors } = await openPlayers(browser, 3);
  const [host, g1] = pages;
  const pickFirst = async (p: Page) => {
    const card = p.locator('.player-edge[data-viewer="true"] .card[data-face="up"]:not(.dimmed)').first();
    await card.click({ position: { x: 6, y: 40 } });
    await p.getByRole('button', { name: 'Choose' }).click();
  };
  await pickFirst(host);
  // everyone sees one face-down card, labelled with the host's name
  await expect(g1.getByTestId('setup-picks').locator('.card[data-face="down"]')).toHaveCount(1);
  await expect(g1.getByTestId('setup-picks')).toContainText('Host');
  await pickFirst(g1);
  await expect(host.getByTestId('setup-picks').locator('.card')).toHaveCount(2);
  await pickFirst(pages[2]);
  // all chosen: the face-down cards give way to the revealed pile
  await expect(host.getByTestId('setup-picks')).toHaveCount(0);
  await expect(host.locator('.pile .card[data-face="up"]')).toHaveCount(3);
  expect(errors).toEqual([]);
});

test('pointing at a board location explains what it does', async ({ browser }) => {
  const { pages, errors } = await openPlayers(browser, 2);
  const board = (await pages[0].getByTestId('board').boundingBox())!;
  // the Mad Hatter's Place, around 40% across and 40% down the board
  await pages[0].mouse.move(board.x + board.width * 0.4, board.y + board.height * 0.4);
  await expect(pages[0].getByTestId('location-tip')).toContainText('ignore the colour rule');
  await expect(pages[0].getByTestId('location-tip')).toContainText("Mad Hatter's Party");
  expect(errors).toEqual([]);
});
