import { expect, test, type Locator, type Page } from '@playwright/test';
import { makeState, num, sp } from '../src/engine/testkit';
import { cardLabel } from '../src/engine/cards';
import { SAVE_KEY } from '../src/ui/save';

async function playEffect(page: Page, name: 'cheshire-cat' | 'rabbit-hole') {
  const card = sp(name);
  const state = makeState({
    players: [
      { name: 'Alice', position: 'red-queen', hand: [card, num('W', 7)] },
      { name: 'Lily', position: 'chess', hand: [num('R', 9)] },
      { name: 'Edith', position: 'mad-hatter', hand: [num('W', 2)] },
    ],
  });
  await page.addInitScript(({ key, game }) => localStorage.setItem(key, JSON.stringify(game)), { key: SAVE_KEY, game: state });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue one-screen game' }).click();
  await page.getByTestId('handoff').click();
  const edge = page.locator('.player-edge.glowing');
  await edge.getByRole('button', { name: 'Peek' }).click();
  await edge.getByRole('button', { name: cardLabel(card) }).click({ position: { x: 6, y: 30 } });
  await page.getByRole('dialog').getByRole('button', { name: 'Play' }).click();
  const effect = page.locator(`.anim-special[data-effect="${name}"]`);
  await expect(effect).toBeAttached();
  return effect;
}

async function pauseAt(effect: Locator, time: number) {
  await effect.evaluate((element, ms) => {
    for (const animation of element.getAnimations({ subtree: true })) {
      animation.pause();
      animation.currentTime = ms;
    }
  }, time);
}

test('the Cheshire Cat grin outlasts its card while Alice gains protection', async ({ page }) => {
  const effect = await playEffect(page, 'cheshire-cat');
  await pauseAt(effect, 3390);
  await expect(effect.locator('.anim-cheshire-grin')).toHaveCSS('opacity', '1');
  await expect(effect.locator('.anim-cheshire-card')).toHaveCSS('opacity', '0');
  await expect(page.getByTestId('effects')).toContainText('Alice is immune');
});

test('the Rabbit Hole tumbles its card and marks the two locations reached', async ({ page }) => {
  const effect = await playEffect(page, 'rabbit-hole');
  await expect(page.locator('.anim-rabbit-arrival')).toHaveCount(2);
  await pauseAt(effect, 2940);
  await expect(effect.locator('.anim-rabbit-portal')).toHaveCSS('opacity', '1');
  await expect(effect.locator('.anim-rabbit-card')).not.toHaveCSS('transform', 'none');
  await expect(page.getByTestId('log')).toContainText("Alice moves to the White Queen's Castle");
  await expect(page.getByTestId('log')).toContainText('Edith moves to the Black Forest');
  await expect(page.getByTestId('log')).not.toContainText('Lily moves');
});

test('reduced motion shows the Rabbit Hole card with a fade and no tumble', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const effect = await playEffect(page, 'rabbit-hole');
  await expect(effect).toHaveCSS('animation-name', 'rm-fade');
  await expect(effect.locator('.anim-rabbit-card')).toHaveCSS('animation-name', 'none');
  await expect(effect.locator('.anim-rabbit-portal')).toBeHidden();
});
