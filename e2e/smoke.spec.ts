import { expect, test, type Page } from '@playwright/test';
import { clickCard, expectNoHandLeak, randomMove } from './helpers';

async function startGame(page: Page, players: 2 | 3 | 4) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Play on one screen' }).click();
  await page.getByRole('button', { name: `${players} players` }).click();
  await page.getByRole('button', { name: 'Start' }).click();
}

test('starts a 4-player game and plays the setup round', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startGame(page, 4);
  for (let seat = 0; seat < 4; seat++) {
    await expectNoHandLeak(page);
    await page.getByTestId('handoff').click();
    const card = page.locator('.player-edge.glowing .card[data-face="up"]:not(.dimmed)').first();
    await clickCard(page, card);
    await page.getByRole('button', { name: 'Choose' }).click();
  }
  await expect(page.getByTestId('log')).toContainText('goes first');
  // the starting player gets a hand-off banner, unless they were the last to pick and still hold the mouse
  await expect(page.getByTestId('handoff').or(page.getByRole('button', { name: 'Peek' }))).toBeVisible();
  await expectNoHandLeak(page);
  await page.screenshot({ path: 'test-results/table-1366.png' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.screenshot({ path: 'test-results/table-1920.png' });
  expect(errors).toEqual([]);
});

for (const players of [3, 2] as const) {
  test(`a ${players}-player one-screen game survives 150 random moves without leaking hands`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await startGame(page, players);
    for (let moves = 0; moves < 150; moves++) {
      if (await page.getByText('escaped Wonderland').count()) break;
      await randomMove(page);
    }
    expect(errors).toEqual([]);
  });
}

test('with reduced motion, banners do not slide', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await startGame(page, 3);
  const name = await page.locator('.handoff-title').evaluate((el) => getComputedStyle(el).animationName);
  expect(name).toBe('none');
  await ctx.close();
});
