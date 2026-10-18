import { expect, test } from '@playwright/test';

test('el panel no es indexable', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});
