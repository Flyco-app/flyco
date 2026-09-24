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

test('unauthenticated admin access is routed through verified sign-in', async ({
  page,
}) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/en\/login$/);
  await expect(page.locator('input[type=email]')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Flyco Operations' }),
  ).toHaveCount(0);
});
