import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

test.skip(
  !process.env.E2E_AUTH_LOCAL,
  'Only runs against local Supabase Auth and PostgreSQL',
);

const supabaseUrl = process.env.SUPABASE_URL;
const localSecret = process.env.E2E_LOCAL_SECRET_KEY;
const localDb = process.env.E2E_LOCAL_DB_URL;

function sql(input: string, variables: Record<string, string>) {
  if (!localDb) throw new Error('Local database URL unavailable');
  const args = [localDb, '-v', 'ON_ERROR_STOP=1'];
  for (const [key, value] of Object.entries(variables)) {
    args.push('-v', `${key}=${value}`);
  }
  execFileSync('psql', args, {
    input,
    stdio: ['pipe', 'ignore', 'ignore'],
  });
}

async function login(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
) {
  await page.goto('/en/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/en\/profile$/);
}

test('sender proposes and traveler atomically accepts a booking', async ({
  browser,
}) => {
  if (!supabaseUrl || !localSecret)
    throw new Error('Local Supabase admin environment unavailable');
  const admin = createClient(supabaseUrl, localSecret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const suffix = randomUUID();
  const senderEmail = `booking-sender-${suffix}@example.invalid`;
  const travelerEmail = `booking-traveler-${suffix}@example.invalid`;
  const password = `B00king-${randomUUID()}`;
  const tripId = randomUUID();
  const requestId = randomUUID();
  const itemId = randomUUID();
  let senderId: string | undefined;
  let travelerId: string | undefined;
  let bookingId: string | undefined;
  const senderContext = await browser.newContext();
  const travelerContext = await browser.newContext();
  try {
    const sender = await admin.auth.admin.createUser({
      email: senderEmail,
      password,
      email_confirm: true,
    });
    const traveler = await admin.auth.admin.createUser({
      email: travelerEmail,
      password,
      email_confirm: true,
    });
    senderId = sender.data.user?.id;
    travelerId = traveler.data.user?.id;
    expect(senderId).toBeTruthy();
    expect(travelerId).toBeTruthy();

    sql(
      `
      insert into public.profiles(id,display_name,locale) values
        (:'sender_id'::uuid,'E2E Booking Sender','en'),
        (:'traveler_id'::uuid,'E2E Booking Traveler','en');
      insert into public.trips(id,owner_id,origin_location_id,destination_location_id,departure_at,arrival_at,capacity_grams,status,published_at)
      values(:'trip_id'::uuid,:'traveler_id'::uuid,'20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',now()+interval '12 days',now()+interval '12 days 4 hours',5000,'published',now());
      insert into public.trip_categories(trip_id,category_code) values(:'trip_id'::uuid,'documents');
      insert into public.delivery_requests(id,owner_id,origin_location_id,destination_location_id,earliest_departure_at,latest_delivery_at,status,published_at)
      values(:'request_id'::uuid,:'sender_id'::uuid,'20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',now()+interval '11 days',now()+interval '13 days','published',now());
      insert into public.declared_items(id,delivery_request_id,category_code,title,description,declared_contents,weight_grams,quantity,fragile)
      values(:'item_id'::uuid,:'request_id'::uuid,'documents','E2E signed documents','A sealed envelope of signed agreements.','Two signed paper agreements',3000,1,false);
      `,
      {
        sender_id: senderId!,
        traveler_id: travelerId!,
        trip_id: tripId,
        request_id: requestId,
        item_id: itemId,
      },
    );

    const senderPage = await senderContext.newPage();
    await login(senderPage, senderEmail, password);
    await senderPage.goto(`/en/delivery-requests/${requestId}/matches`);
    await expect(
      senderPage.getByRole('heading', {
        name: 'Matches for this delivery request',
      }),
    ).toBeVisible();
    await senderPage.getByRole('button', { name: 'Propose booking' }).click();
    await expect(senderPage).toHaveURL(
      /\/en\/bookings\/[0-9a-f-]+\?notice=proposed$/,
    );
    bookingId = new URL(senderPage.url()).pathname.split('/').at(-1);
    expect(bookingId).toMatch(/^[0-9a-f-]{36}$/);
    await expect(senderPage.getByText('Proposed')).toBeVisible();
    await expect(senderPage.getByText('E2E Booking Traveler')).toBeVisible();

    const travelerPage = await travelerContext.newPage();
    await login(travelerPage, travelerEmail, password);
    await travelerPage.goto('/en/bookings');
    await expect(
      travelerPage.getByRole('heading', { name: 'My bookings' }),
    ).toBeVisible();
    await travelerPage.getByRole('link', { name: 'View booking' }).click();
    await expect(travelerPage.getByText('Incoming proposal')).toBeVisible();
    await travelerPage.getByRole('button', { name: 'Accept' }).click();
    await expect(travelerPage).toHaveURL(/notice=accepted/);
    await expect(
      travelerPage.locator('.status-badge').filter({ hasText: /^Accepted$/ }),
    ).toBeVisible();
    await expect(travelerPage.getByText(/2 kg/)).toBeVisible();

    await travelerPage.goto(`/ar/bookings/${bookingId}`);
    await expect(travelerPage.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(
      travelerPage.getByRole('heading', { name: 'الحجز', exact: true }),
    ).toBeVisible();

    await senderPage.goto(`/en/bookings/${bookingId}`);
    await expect(
      senderPage.locator('.status-badge').filter({ hasText: /^Accepted$/ }),
    ).toBeVisible();
    await senderPage.locator('.destructive-section > summary').click();
    await senderPage.getByLabel('Cancellation reason').fill('E2E release');
    await senderPage.getByRole('button', { name: 'Cancel' }).click();
    await expect(senderPage).toHaveURL(/notice=cancelled/);
    await expect(senderPage.getByText('Cancelled')).toBeVisible();
    await expect(
      senderPage.locator('.capacity-panel').getByText('5 kg').first(),
    ).toBeVisible();
  } finally {
    sql(
      `
      delete from public.booking_command_receipts where booking_id in (select id from public.bookings where trip_id=:'trip_id'::uuid);
      delete from public.booking_events where booking_id in (select id from public.bookings where trip_id=:'trip_id'::uuid);
      delete from public.capacity_reservations where trip_id=:'trip_id'::uuid;
      delete from public.bookings where trip_id=:'trip_id'::uuid;
      delete from public.matches where trip_id=:'trip_id'::uuid;
      delete from public.delivery_request_events where delivery_request_id=:'request_id'::uuid;
      delete from public.declared_items where delivery_request_id=:'request_id'::uuid;
      delete from public.delivery_requests where id=:'request_id'::uuid;
      delete from public.trip_events where trip_id=:'trip_id'::uuid;
      delete from public.trip_categories where trip_id=:'trip_id'::uuid;
      delete from public.trips where id=:'trip_id'::uuid;
      `,
      { trip_id: tripId, request_id: requestId },
    );
    if (senderId) await admin.auth.admin.deleteUser(senderId);
    if (travelerId) await admin.auth.admin.deleteUser(travelerId);
    await senderContext.close();
    await travelerContext.close();
  }
});
