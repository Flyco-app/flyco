import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

test.skip(
  !process.env.E2E_AUTH_LOCAL,
  'Only runs against local Supabase Auth and Mailpit',
);
const mailpit = process.env.E2E_MAILPIT_URL;
const supabaseUrl = process.env.SUPABASE_URL;

async function findMail(email: string, type: 'signup' | 'recovery') {
  if (!mailpit || !supabaseUrl)
    throw new Error('Local mail environment unavailable');
  for (let attempt = 0; attempt < 30; attempt++) {
    const list = (await fetch(
      `${mailpit}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    ).then((r) => r.json())) as { messages?: { ID: string }[] };
    for (const message of list.messages ?? []) {
      const body = (await fetch(
        `${mailpit}/api/v1/message/${encodeURIComponent(message.ID)}`,
      ).then((r) => r.json())) as { HTML: string; Text: string };
      const links =
        `${body.HTML}\n${body.Text}`.match(/https?:\/\/[^\s<>"']+/g) ?? [];
      const url = links
        .map((s) => new URL(s.replaceAll('&amp;', '&')))
        .find(
          (link) =>
            link.origin === supabaseUrl &&
            link.pathname === '/auth/v1/verify' &&
            link.searchParams.get('type') === type,
        );
      if (url) return url.href;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Local ${type} email not received`);
}

test('signup, verification, profile edit, logout, login and recovery', async ({
  page,
}) => {
  const email = `phase1-${randomUUID()}@example.invalid`;
  const password = `V3ryStrong-${randomUUID()}`;
  const replacement = `N3wStrong-${randomUUID()}`;
  let userId: string | undefined;
  const cspViolations: string[] = [];
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy'))
      cspViolations.push(message.text());
  });
  try {
    const authPage = await page.goto('/en/profile');
    expect(authPage?.headers()['content-security-policy']).toContain('nonce-');
    await expect(page).toHaveURL(/\/en\/login$/);
    await page.goto('/en/signup');
    await page.getByLabel('Display name').fill('Test Member');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Create an account' }).click();
    await expect(page).toHaveURL(/\/en\/check-email$/);
    await page.goto('/en/login');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await page.goto(await findMail(email, 'signup'));
    await expect(page).toHaveURL(/\/en\/profile$/);
    await expect(page.getByText('Test Member')).toBeVisible();
    await page.getByRole('link', { name: 'Account settings' }).click();
    await page.getByLabel('Display name').fill('Updated Member');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByLabel('Display name')).toHaveValue('Updated Member');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/en\/login$/);
    await page.goto('/en/profile');
    await expect(page).toHaveURL(/\/en\/login$/);
    await page.goto('/en/reset-password');
    await page.getByLabel('Email address').fill(email);
    await page.getByRole('button', { name: 'Reset password' }).click();
    await expect(page).toHaveURL(/\/en\/check-email$/);
    await page.goto(await findMail(email, 'recovery'));
    await expect(page).toHaveURL(/\/en\/new-password$/);
    await page.getByLabel('New password').fill(replacement);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/en\/login\?notice=password-updated$/);
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill(replacement);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Updated Member')).toBeVisible();
    await page.goto('/en/settings');
    await page
      .getByLabel('Email address')
      .fill(`changed-${randomUUID()}@example.invalid`);
    await page.getByRole('button', { name: 'Email address' }).click();
    await expect(page).toHaveURL(/\/en\/check-email$/);
    expect(cspViolations).toEqual([]);
  } finally {
    if (
      supabaseUrl &&
      process.env.E2E_LOCAL_SECRET_KEY &&
      process.env.SUPABASE_PUBLISHABLE_KEY
    ) {
      const admin = createClient(
        supabaseUrl,
        process.env.E2E_LOCAL_SECRET_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      if (!userId) {
        const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
        userId = data.users.find((u) => u.email === email)?.id;
      }
      if (userId) await admin.auth.admin.deleteUser(userId);
    }
  }
});

test('Arabic shell has RTL semantics', async ({ page }) => {
  await page.goto('/ar/login');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(
    page.getByRole('heading', { name: 'تسجيل الدخول' }),
  ).toBeVisible();
});
