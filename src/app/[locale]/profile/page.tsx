import Link from 'next/link';
import { requireActiveAccount } from '@/lib/auth/session';
import { dictionaries } from '@/lib/auth/dictionaries';
import { safeLocale } from '@/lib/auth/validation';
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = safeLocale((await params).locale);
  const { profile } = await requireActiveAccount(locale);
  const d = dictionaries[locale];
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{d.profile}</h1>
      <p>{profile.display_name}</p>
      <Link href={`/${locale}/settings`}>{d.settings}</Link>
    </section>
  );
}
