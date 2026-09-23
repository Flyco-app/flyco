import Link from 'next/link';
import { dictionaries } from '@/lib/auth/dictionaries';
import { safeLocale } from '@/lib/auth/validation';
import { uiCopy } from '@/lib/ui/copy';
import { Icon } from '@/components/ui/icon';
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = safeLocale((await params).locale);
  return (
    <section className="auth-panel space-y-5">
      <span className="icon-tile">
        <Icon name="check" />
      </span>
      <h1>{dictionaries[locale].checkEmail}</h1>
      <p role="status">{uiCopy[locale].emailHint}</p>
      <Link className="button button-secondary" href={`/${locale}/login`}>
        {uiCopy[locale].backLogin}
      </Link>
    </section>
  );
}
