import type { Locale } from '@/lib/auth/validation';
import { dictionaries } from '@/lib/auth/dictionaries';
import { uiCopy } from '@/lib/ui/copy';
import { Icon } from './icon';
export function TrustPanel({
  locale,
  email,
  phone,
  identity,
  completed = 0,
  reviews = 0,
  memberSince,
}: {
  locale: Locale;
  email: boolean;
  phone?: boolean;
  identity: boolean;
  completed?: number;
  reviews?: number;
  memberSince?: string;
}) {
  const d = dictionaries[locale];
  return (
    <section className="space-y-4 rounded-xl border p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <Icon name="shield" />
        {d.trust}
      </h2>
      <ul className="trust-grid">
        {[
          { label: d.emailVerified, value: email },
          ...(phone === undefined
            ? []
            : [{ label: d.phoneVerified, value: phone }]),
          { label: d.identityVerified, value: identity },
        ].map((row) => (
          <li key={row.label} className="trust-row">
            <span>{row.label}</span>
            {row.value ? (
              <span className="status-badge status-success">
                <Icon name="check" />
                <span className="sr-only">{uiCopy[locale].verified}</span>
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                {uiCopy[locale].notVerified}
              </span>
            )}
          </li>
        ))}
      </ul>
      {memberSince && (
        <p className="text-sm text-muted-foreground">
          {uiCopy[locale].memberSince}{' '}
          <time dateTime={memberSince}>
            {new Intl.DateTimeFormat(locale, {
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            }).format(new Date(memberSince))}
          </time>
        </p>
      )}
      {completed > 0 && (
        <p>
          {d.completed}: {new Intl.NumberFormat(locale).format(completed)}
        </p>
      )}
      {reviews > 0 && (
        <p>
          {d.reviews}: {new Intl.NumberFormat(locale).format(reviews)}
        </p>
      )}
    </section>
  );
}
