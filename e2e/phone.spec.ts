import { devices, expect, test, type Page } from '@playwright/test';
import { randomMove } from './helpers';

const PHONE = devices['iPhone 13 landscape'];

async function insideViewport(page: Page, selector: string) {
  const vp = page.viewportSize()!;
  const boxes = await page.locator(selector).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
  for (const b of boxes) {
    expect(b.left, `${selector} left`).toBeGreaterThanOrEqual(-1);
    expect(b.top, `${selector} top`).toBeGreaterThanOrEqual(-1);
    expect(b.right, `${selector} right`).toBeLessThanOrEqual(vp.width + 1);
    expect(b.bottom, `${selector} bottom`).toBeLessThanOrEqual(vp.height + 1);
  }
}

test('a phone held sideways can join and play an online game', async ({ browser }) => {
  const errors: string[] = [];
  const host = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  const phoneCtx = await browser.newContext({ ...PHONE, defaultBrowserType: undefined } as never);
  const phone = await phoneCtx.newPage();
  for (const p of [host, phone]) p.on('pageerror', (e) => errors.push(e.message));

  await host.goto('/');
  await host.getByRole('button', { name: 'Create online room' }).click();
  await host.locator('input').first().fill('Host');
  await host.getByRole('button', { name: 'Create' }).click();
  const code = (await host.getByTestId('room-code').innerText()).trim();

  await phone.goto(`/?room=${code}`);
  await expect(phone.locator('.stage.phone')).toBeVisible();
  await phone.locator('input').first().fill('Phone');
  await phone.getByRole('button', { name: 'Join' }).tap();
  await expect(phone.getByText('Waiting for the host to start')).toBeVisible();
  await insideViewport(phone, '.lobby button');

  await host.getByRole('button', { name: 'Start game' }).click();
  await expect(phone.locator('.player-edge[data-viewer="true"] .card[data-face="up"]')).toHaveCount(7);
  for (const sel of ['[data-testid="board"]', '.player-edge[data-viewer="true"] .plate', '.player-edge.opponent', '.corner-tr .btn']) {
    await insideViewport(phone, sel);
  }
  await phone.screenshot({ path: 'test-results/phone-table.png' });

  // host picks first; then the phone taps a card and chooses it
  await host.locator('.player-edge[data-viewer="true"] .card[data-face="up"]:not(.dimmed)').first().click({ position: { x: 6, y: 40 } });
  await host.getByRole('button', { name: 'Choose' }).click();
  await phone.locator('.player-edge[data-viewer="true"] .card[data-face="up"]:not(.dimmed)').first().tap({ position: { x: 5, y: 40 } });
  await insideViewport(phone, '.preview');
  await phone.getByRole('button', { name: 'Choose' }).tap();
  await expect(host.getByTestId('log')).toContainText('goes first');

  for (let i = 0; i < 60; i++) {
    if (await host.getByText('escaped Wonderland').count()) break;
    for (const p of [host, phone]) if (await randomMove(p)) break;
  }
  await phone.screenshot({ path: 'test-results/phone-later.png' });
  await expect(phone.locator('.player-edge[data-viewer="false"] [data-face="up"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a phone held upright is asked to turn sideways', async ({ browser }) => {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: undefined } as never);
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.getByTestId('rotate-phone')).toBeVisible();
  await expect(page.getByTestId('rotate-phone')).toContainText('Turn your phone sideways');
});
