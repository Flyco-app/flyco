import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

test.skip(
  !process.env.E2E_AUTH_LOCAL,
  'Only runs against local Supabase Auth and Mailpit',
);
const mailpit = process.env.E2E_MAILPIT_URL;
const supabaseUrl = process.env.SUPABASE_URL;

async function findMail(
  email: string,
  type: 'signup' | 'recovery' | 'email_change',
) {
  if (!mailpit || !supabaseUrl)
    throw new Error('Local mail environment unavailable');
  for (let attempt = 0; attempt < 10; attempt++) {
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
            link.origin === 'http://127.0.0.1:3000' &&
            link.pathname === '/auth/confirm' &&
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
  let changedEmail: string | undefined;
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
    const signupLink = await findMail(email, 'signup');
    const confirmationContext = await page.context().browser()!.newContext();
    const confirmationPage = await confirmationContext.newPage();
    await confirmationPage.goto(signupLink);
    await confirmationPage
      .getByRole('button', { name: 'Continue securely' })
      .click();
    await expect(confirmationPage).toHaveURL(/\/fr\/profile$/);
    await confirmationContext.close();
    await page.goto('/en/login');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/en\/profile$/);
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
      const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
      userId = data.users.find((user) => user.email === email)?.id;
      expect(userId).toBeTruthy();
    }
    const replayContext = await page.context().browser()!.newContext();
    const replayPage = await replayContext.newPage();
    await replayPage.goto(signupLink);
    await replayPage.getByRole('button', { name: 'Continue securely' }).click();
    await expect(replayPage).toHaveURL(
      /\/fr\/login\?error=confirmation-failed$/,
    );
    await replayContext.close();
    await expect(page.getByText('Test Member')).toBeVisible();
    await page.getByRole('link', { name: 'Account settings' }).click();
    await page.getByLabel('Display name').fill('Updated Member');
    await page.getByLabel('First name').fill('Updated');
    await page.getByLabel('Last name').fill('Member');
    await page.getByLabel('Phone (E.164)').fill('+33612345678');
    await page.getByLabel('Short bio').fill('Public profile biography');
    await page
      .getByLabel('City of residence')
      .selectOption({ label: 'Paris, France' });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByLabel('Display name')).toHaveValue('Updated Member');
    await expect(page.getByLabel('Phone (E.164)')).toHaveValue('+33612345678');
    await page.getByLabel('Profile photo').setInputFiles({
      name: 'ignored-original-name.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    });
    await page.getByRole('button', { name: 'Upload photo' }).click();
    await expect(page).toHaveURL(/\/en\/settings\?notice=avatar-saved$/);
    await expect(
      page.getByRole('img', { name: 'Updated Member' }),
    ).toBeVisible();
    expect(userId).toBeTruthy();
    await page.goto(`/en/members/${userId}`);
    await expect(
      page.getByRole('heading', { name: 'Updated Member' }),
    ).toBeVisible();
    await expect(page.getByText('Public profile biography')).toBeVisible();
    await expect(page.getByText(email)).toHaveCount(0);
    await expect(page.getByText('+33612345678')).toHaveCount(0);
    await expect(
      page.getByRole('img', { name: 'Updated Member' }),
    ).toBeVisible();
    await page.goto('/ar/settings');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByLabel('الاسم الأول')).toHaveValue('Updated');
    await page.goto('/en/settings');
    await page.getByLabel('City of residence').evaluate((select) => {
      const option = document.createElement('option');
      option.value = '90000000-0000-4000-8000-000000000009';
      option.textContent = 'Tampered';
      select.append(option);
    });
    await page
      .getByLabel('City of residence')
      .selectOption('90000000-0000-4000-8000-000000000009');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/en\/settings\?error=invalid$/);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/en\/login$/);
    await page.goto('/en/profile');
    await expect(page).toHaveURL(/\/en\/login$/);
    await page.goto('/en/reset-password');
    await page.getByLabel('Email address').fill(email);
    await page.getByRole('button', { name: 'Reset password' }).click();
    await expect(page).toHaveURL(/\/en\/check-email$/);
    const recoveryLink = await findMail(email, 'recovery');
    const recoveryContext = await page.context().browser()!.newContext();
    const recoveryPage = await recoveryContext.newPage();
    await recoveryPage.goto(recoveryLink);
    await recoveryPage
      .getByRole('button', { name: 'Continue securely' })
      .click();
    await expect(recoveryPage).toHaveURL(/\/fr\/new-password$/);
    page = recoveryPage;
    await page.locator('input[name=password]').fill(replacement);
    await page.locator('button[type=submit]').click();
    await expect(page).toHaveURL(/\/fr\/login\?notice=password-updated$/);
    await page.locator('input[name=email]').fill(email);
    await page.locator('input[name=password]').fill(replacement);
    await page.locator('button[type=submit]').click();
    await expect(page.getByText('Updated Member')).toBeVisible();
    await page.goto('/en/settings');
    changedEmail = `changed-${randomUUID()}@example.invalid`;
    await page.getByLabel('Email address').fill(changedEmail);
    await page.getByRole('button', { name: 'Email address' }).click();
    await expect(page).toHaveURL(/\/en\/check-email$/);
    const newAddressLink = await findMail(changedEmail, 'email_change');
    const oldAddressLink = await findMail(email, 'email_change');
    expect(newAddressLink).not.toBe(oldAddressLink);
    const firstChangeContext = await page.context().browser()!.newContext();
    const firstChangePage = await firstChangeContext.newPage();
    await firstChangePage.goto(oldAddressLink);
    await firstChangePage
      .getByRole('button', { name: 'Continue securely' })
      .click();
    await firstChangeContext.close();
    const changeContext = await page.context().browser()!.newContext();
    const changePage = await changeContext.newPage();
    await changePage.goto(newAddressLink);
    await changePage.getByRole('button', { name: 'Continue securely' }).click();
    await expect(changePage).toHaveURL(/\/fr\/settings$/);
    await changeContext.close();
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
        userId = data.users.find(
          (user) => user.email === email || user.email === changedEmail,
        )?.id;
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
