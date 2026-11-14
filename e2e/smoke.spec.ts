import { expect, test, type Locator, type Page } from '@playwright/test';

/** Click the visible strip of a fanned card, whichever edge it sits on. */
async function clickCard(page: Page, card: Locator) {
  const cls = (await page.locator('.player-edge.glowing').getAttribute('class')) ?? '';
  const edge = /edge-(\w+)/.exec(cls)?.[1] ?? 'bottom';
  const b = (await card.boundingBox())!;
  const pos = {
    bottom: { x: 5, y: b.height / 2 },
    top: { x: b.width - 5, y: b.height / 2 },
    left: { x: b.width / 2, y: 5 },
    right: { x: b.width / 2, y: b.height - 5 },
  }[edge]!;
  await card.click({ position: pos });
}

async function expectNoHandLeak(page: Page) {
  if (await page.getByTestId('handoff').count()) {
    await expect(page.locator('.player-edge [data-face="up"]')).toHaveCount(0);
  }
}

async function startGame(page: Page, players: 3 | 4) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'New game' }).click();
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

test('a 3-player game survives 150 random moves through the UI without leaking hands', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startGame(page, 3);
  const rnd = (n: number) => Math.floor(Math.random() * n);
  for (let moves = 0; moves < 150; ) {
    if (await page.getByText('escaped Wonderland').count()) break;
    if (await page.getByTestId('handoff').count()) {
      await expectNoHandLeak(page);
      await page.getByTestId('handoff').click();
      continue;
    }
    moves++;
    const edge = page.locator('.player-edge.glowing');
    const prompt = page.getByTestId('prompt');
    if (await prompt.count()) {
      const text = await prompt.innerText();
      for (const sel of ['.location-area.selectable', '.plate.targetable', '.active-row .card.clickable']) {
        const t = page.locator(sel);
        if (await t.count()) {
          await t.nth(rnd(await t.count())).click();
          break;
        }
      }
      if (!(await prompt.count()) || (await prompt.innerText()) !== text) continue;
      const backs = prompt.locator('.card.clickable');
      if (await backs.count()) {
        await backs.nth(rnd(await backs.count())).click();
        continue;
      }
      const values = prompt.locator('.value-grid .btn');
      if (await values.count()) {
        await values.nth(rnd(13)).click();
        continue;
      }
      const hand = edge.locator('.card[data-face="up"]:not(.dimmed)');
      if (/starting card/.test(text)) {
        await clickCard(page, hand.first());
        await page.getByRole('button', { name: 'Choose' }).click();
        continue;
      }
      if (/Choose 1|Give it|Play it/.test(text) && (await hand.count())) await clickCard(page, hand.first());
      const buttons = prompt.locator('button:enabled');
      await buttons.nth((await buttons.count()) - 1).click();
      continue;
    }
    const peek = edge.getByRole('button', { name: 'Peek' });
    if (await peek.count()) await peek.click();
    const playable = edge.locator('.card[data-face="up"]:not(.dimmed)');
    const n = await playable.count();
    if (n && Math.random() < 0.85) {
      await clickCard(page, playable.nth(rnd(n)));
      const play = page.getByRole('button', { name: 'Play' });
      if (await play.isEnabled()) {
        await play.click();
        continue;
      }
      await page.getByRole('button', { name: 'Back' }).click();
    }
    await edge.getByRole('button', { name: /^(Pass|Stay down)$/ }).click();
  }
  expect(errors).toEqual([]);
});
