import { expect, test } from '@playwright/test';

test('foundation shell renders without client failures', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: /Sur votre chemin/ }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  expect(response?.headers()['x-content-type-options']).toBe('nosniff');
  expect(response?.headers()['content-security-policy']).toContain(
    "frame-ancestors 'none'",
  );
  expect(errors).toEqual([]);
});

test('admin is not accidentally exposed before authorization exists', async ({
  page,
}) => {
  const response = await page.goto('/admin');
  expect(response?.status()).toBe(404);
});
