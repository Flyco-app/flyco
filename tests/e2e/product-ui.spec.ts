import { expect, test } from '@playwright/test';

for (const locale of ['fr', 'en', 'ar']) {
  for (const width of [360, 768, 1440]) {
    test(`product home and auth navigation ${locale} at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${locale}`);
      await expect(page.locator('html')).toHaveAttribute(
        'dir',
        locale === 'ar' ? 'rtl' : 'ltr',
      );
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('.hero-actions a')).toHaveCount(2);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.locator('.header-tools > a').click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/login$`));
      await expect(page.locator('input[type=email]')).toBeVisible();
      await page.locator('.auth-switch a').click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/signup$`));
      await expect(page.locator('input[name=displayName]')).toBeVisible();
      await page.locator('.language-switcher a[lang=en]').click();
      await expect(page).toHaveURL(/\/en\/signup$/);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    });
  }
}

test('keyboard skip link and unavailable page are recoverable', async ({
  page,
}) => {
  await page.goto('/en');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to content' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  const response = await page.goto('/en/does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole('heading', { name: 'This page isn’t available' }),
  ).toBeVisible();
});
