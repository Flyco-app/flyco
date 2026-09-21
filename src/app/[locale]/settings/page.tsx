import Link from 'next/link';
import {
  cancelIdentityVerification,
  changeEmail,
  logOut,
  startIdentityVerification,
  updateProfile,
  uploadAvatar,
  removeAvatar,
} from '@/lib/auth/actions';
import { requireActiveAccount } from '@/lib/auth/session';
import { dictionaries } from '@/lib/auth/dictionaries';
import { safeLocale } from '@/lib/auth/validation';
import { AvatarImage } from '@/lib/profile/avatar-image';
import { getServerEnv } from '@/lib/env/server';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const locale = safeLocale((await params).locale);
  const { profile, publicProfile, user, client, verification } =
    await requireActiveAccount(locale);
  const locations = await client
    .from('locations')
    .select('id, canonical_name')
    .eq('kind', 'city')
    .eq('active', true)
    .order('country_code')
    .order('city_name');
  if (locations.error) throw new Error('Unable to load locations.');
  const d = dictionaries[locale];
  const { SUPABASE_URL } = getServerEnv();
  const avatarUrl =
    publicProfile.avatar_path && SUPABASE_URL
      ? `${SUPABASE_URL}/storage/v1/object/public/avatars/${publicProfile.avatar_path}`
      : null;
  const { error, notice } = await searchParams;
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">{d.settings}</h1>
      {error && <p role="alert">{d.genericError}</p>}
      {notice && <p role="status">{d.save}</p>}
      <p>{user.email}</p>
      <form action={updateProfile} className="grid gap-4">
        <input type="hidden" name="locale" value={locale} />
        <label>
          {d.name}
          <input
            className="field"
            name="displayName"
            defaultValue={publicProfile.display_name}
            minLength={2}
            maxLength={80}
            required
          />
        </label>
        <label>
          {d.firstName}
          <input
            className="field"
            name="firstName"
            defaultValue={profile.first_name ?? ''}
            maxLength={80}
            autoComplete="given-name"
          />
        </label>
        <label>
          {d.lastName}
          <input
            className="field"
            name="lastName"
            defaultValue={profile.last_name ?? ''}
            maxLength={80}
            autoComplete="family-name"
          />
        </label>
        <label>
          {d.phone}
          <input
            className="field"
            name="phone"
            defaultValue={profile.phone_e164 ?? ''}
            inputMode="tel"
            placeholder="+33612345678"
          />
        </label>
        <label>
          {d.bio}
          <textarea
            className="field min-h-28"
            name="bio"
            defaultValue={publicProfile.bio ?? ''}
            maxLength={500}
          />
        </label>
        <label>
          {d.residence}
          <select
            className="field"
            name="residenceLocationId"
            defaultValue={publicProfile.residence_location_id ?? ''}
          >
            <option value="">—</option>
            {locations.data.map((location) => (
              <option key={location.id} value={location.id}>
                {location.canonical_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {d.language}
          <select className="field" name="locale" defaultValue={profile.locale}>
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </label>
        <button className="button" type="submit">
          {d.save}
        </button>
      </form>
      <form
        action={uploadAvatar}
        className="grid gap-4"
        encType="multipart/form-data"
      >
        {avatarUrl && (
          <AvatarImage src={avatarUrl} alt={publicProfile.display_name} />
        )}
        <input type="hidden" name="locale" value={locale} />
        <label>
          {d.avatar}
          <input
            className="field"
            name="avatar"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
          />
        </label>
        <button className="button" type="submit">
          {d.uploadAvatar}
        </button>
      </form>
      {publicProfile.avatar_path && (
        <form action={removeAvatar}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit">{d.removeAvatar}</button>
        </form>
      )}
      <section className="grid gap-3 rounded-xl border p-4">
        <h2 className="font-semibold">{d.verification}</h2>
        <p>{verification?.state ?? 'not_started'}</p>
        {!verification && (
          <form action={startIdentityVerification}>
            <input type="hidden" name="locale" value={locale} />
            <button className="button" type="submit">
              {d.startVerification}
            </button>
          </form>
        )}
        {verification &&
          ['pending', 'requires_input'].includes(verification.state) && (
            <form action={cancelIdentityVerification}>
              <input type="hidden" name="locale" value={locale} />
              <input
                type="hidden"
                name="verificationId"
                value={verification.id}
              />
              <input
                type="hidden"
                name="version"
                value={verification.version}
              />
              <button type="submit">{d.cancelVerification}</button>
            </form>
          )}
      </section>
      <form action={changeEmail} className="grid gap-4">
        <input type="hidden" name="locale" value={locale} />
        <label>
          {d.email}
          <input
            className="field"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
        </label>
        <button className="button" type="submit">
          {d.email}
        </button>
      </form>
      <Link href={`/${locale}/reset-password`}>{d.reset}</Link>
      <form action={logOut}>
        <input type="hidden" name="locale" value={locale} />
        <button type="submit">{d.logout}</button>
      </form>
    </section>
  );
}
