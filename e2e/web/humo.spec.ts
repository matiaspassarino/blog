import { expect, test } from '@playwright/test';

test('la portada responde con un único h1 y metadescripción', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
});
