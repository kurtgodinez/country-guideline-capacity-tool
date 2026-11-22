import { test, expect } from '@playwright/test';

test('load pilot, open profile, export JSON', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /Load pilot.*Estonia/ }).click();
  await page.getByRole('button', { name: 'Open Estonia' }).click();

  await page.getByRole('link', { name: /Profile/ }).click();
  await expect(page.getByText('Priority setting').first()).toBeVisible();

  await page.getByRole('link', { name: 'Home', exact: true }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON for Estonia' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
});
