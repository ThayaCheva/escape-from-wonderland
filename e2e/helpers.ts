import { expect, type Locator, type Page } from '@playwright/test';

/** Click the visible strip of a fanned card, whichever edge it sits on. */
export async function clickCard(page: Page, card: Locator) {
  const cls = (await page.locator('.player-edge.glowing').first().getAttribute('class')) ?? '';
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

export async function expectNoHandLeak(page: Page) {
  if (await page.getByTestId('handoff').count()) {
    await expect(page.locator('.player-edge [data-face="up"]')).toHaveCount(0);
  }
}

const rnd = (n: number) => Math.floor(Math.random() * n);

/**
 * Makes one random legal move if this screen is the one that must act.
 * Returns false when there's nothing for this screen to do (online: someone else's turn).
 */
export async function randomMove(page: Page): Promise<boolean> {
  if (await page.getByTestId('handoff').count()) {
    await expectNoHandLeak(page);
    await page.getByTestId('handoff').click();
    return true;
  }
  const edge = page.locator('.player-edge.glowing');
  const prompt = page.getByTestId('prompt');
  if (await prompt.count()) {
    const text = await prompt.innerText();
    for (const sel of ['.location-area.selectable', '.plate.targetable', '.active-row .card.clickable']) {
      const t = page.locator(sel);
      const n = await t.count();
      if (n) {
        await t.nth(rnd(n)).click();
        return true;
      }
    }
    const backs = prompt.locator('.card.clickable');
    if (await backs.count()) {
      await backs.nth(rnd(await backs.count())).click();
      return true;
    }
    const values = prompt.locator('.value-grid .btn');
    if (await values.count()) {
      await values.nth(rnd(13)).click();
      return true;
    }
    const hand = edge.locator('.card[data-face="up"]:not(.dimmed)');
    if (/starting card/.test(text)) {
      await clickCard(page, hand.first());
      await page.getByRole('button', { name: 'Choose' }).click();
      return true;
    }
    if (/Choose 1|Give it|Play it/.test(text) && (await hand.count())) await clickCard(page, hand.first());
    const buttons = prompt.locator('button:enabled');
    await buttons.nth((await buttons.count()) - 1).click();
    return true;
  }
  const pass = edge.getByRole('button', { name: /^(Pass|Stay down)$/ });
  if (!(await pass.count())) return false;
  const peek = edge.getByRole('button', { name: 'Peek' });
  if (await peek.count()) await peek.click();
  const playable = edge.locator('.card[data-face="up"]:not(.dimmed)');
  const n = await playable.count();
  if (n && Math.random() < 0.85) {
    await clickCard(page, playable.nth(rnd(n)));
    const play = page.getByRole('button', { name: 'Play' });
    if (await play.isEnabled()) {
      await play.click();
      return true;
    }
    await page.getByRole('button', { name: 'Back' }).click();
  }
  await pass.click();
  return true;
}
