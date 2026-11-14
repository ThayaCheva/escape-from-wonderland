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
