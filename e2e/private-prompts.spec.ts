import { expect, test, type Page } from '@playwright/test';
import { makeState, num, sp } from '../src/engine/testkit';
import type { GameState } from '../src/engine/types';
import { SAVE_KEY } from '../src/ui/save';
import { clickCard } from './helpers';

async function playFromSave(page: Page, state: GameState, cardName: string) {
  await page.addInitScript(({ key, game }) => localStorage.setItem(key, JSON.stringify(game)), { key: SAVE_KEY, game: state });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue one-screen game' }).click();
  await page.getByTestId('handoff').click();
  await page.getByRole('button', { name: 'Peek' }).click();
  await clickCard(page, page.getByRole('button', { name: cardName, exact: true }));
  await page.getByRole('dialog').getByRole('button', { name: 'Play', exact: true }).click();
}

test('Caterpillar lets each player inspect the other hand after their private handoff', async ({ page }) => {
  const state = makeState({
    players: [
      { name: 'Alice', hand: [sp('caterpillar'), num('W', 7)] },
      { name: 'Lily', hand: [num('W', 2), num('R', 8)] },
      { name: 'Edith', hand: [num('R', 9)] },
    ],
  });
  await playFromSave(page, state, 'Wisdom of Caterpillar');
  await page.getByRole('button', { name: 'Choose Lily', exact: true }).click();
  const lily = page.getByRole('dialog', { name: 'Lily’s hand' });
  const redEight = lily.getByRole('button', { name: 'Red 8', exact: true });
  await expect(lily.getByRole('button', { name: 'Done' })).toBeFocused();
  await redEight.click();
  await expect(redEight).toHaveAttribute('aria-pressed', 'true');
  await expect(lily.getByTestId('revealed-card').getByRole('img', { name: 'Red 8' })).toBeVisible();
  await expect(page.locator('.player-edge .card[data-face="up"]')).toHaveCount(0);

  await lily.getByRole('button', { name: 'Done' }).click();
  const alice = page.getByRole('dialog', { name: 'Alice’s hand' });
  await expect(alice).toHaveCount(0);
  await page.getByTestId('handoff').click();
  await expect(alice.getByTestId('revealed-card').getByRole('img', { name: 'White 7' })).toBeVisible();
  await expect(alice.getByRole('button', { name: 'Red 8' })).toHaveCount(0);
  await alice.getByRole('button', { name: 'Done' }).click();
  await expect(alice).toHaveCount(0);
});

for (const holdsMatch of [false, true]) {
  test(`Execution Order waits for the target ${holdsMatch ? 'to accept a match' : 'to acknowledge drawing five'}`, async ({ page }) => {
    const state = makeState({
      players: [
        { name: 'Alice', hand: [sp('execution-order'), num('W', 6)] },
        { name: 'Lily', hand: [num('R', holdsMatch ? 7 : 8), num('W', 10)] },
        { name: 'Edith', hand: [num('R', 9)] },
      ],
      deck: Array.from({ length: 6 }, () => num('W', 11)),
    });
    await playFromSave(page, state, 'Execution Order');
    const prompt = page.getByTestId('prompt');
    await prompt.getByRole('button', { name: '7', exact: true }).click();
    await page.getByTestId('handoff').click();
    await expect(prompt).toContainText('Alice declared 7.');
    await expect(page.getByTestId('log')).not.toContainText('draws 5 cards');
    if (holdsMatch) {
      await expect(prompt.getByRole('button', { name: 'Draw 5 instead' })).toBeVisible();
      await prompt.getByRole('button', { name: 'Play Red 7' }).click();
      await expect(page.getByTestId('log')).toContainText('Alice draws 5 cards.');
      await expect(page.locator('.pile')).toContainText('7');
    } else {
      await expect(prompt).toContainText('You have no matching card.');
      await prompt.getByRole('button', { name: 'Draw 5 cards', exact: true }).click();
      await expect(page.getByTestId('log')).toContainText('Lily draws 5 cards.');
    }
  });
}
