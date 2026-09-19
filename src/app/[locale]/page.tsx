import Link from 'next/link';
import { dictionaries } from '@/lib/auth/dictionaries';
import { safeLocale } from '@/lib/auth/validation';
export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = safeLocale((await params).locale);
  const d = dictionaries[locale];
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-semibold">{d.welcome}</h1>
      <p>Flyco</p>
      <div className="flex gap-4">
        <Link href={`/${locale}/signup`}>{d.signup}</Link>
        <Link href={`/${locale}/login`}>{d.login}</Link>
      </div>
    </div>
  );
}
