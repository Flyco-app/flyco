import { getServerEnv } from '@/lib/env/server';
import Link from 'next/link';
import { safeLocale } from '@/lib/auth/validation';
import { getVerifiedIdentity } from '@/lib/auth/session';
import { uiCopy } from '@/lib/ui/copy';
import { Icon, type IconName } from '@/components/ui/icon';
export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = safeLocale((await params).locale);
  const d = uiCopy[locale];
  const configured = Boolean(getServerEnv().SUPABASE_URL);
  const authenticated = configured && Boolean(await getVerifiedIdentity());
  const activities: {
    href: string;
    title: string;
    body: string;
    icon: IconName;
  }[] = [
    {
      href: 'delivery-requests',
      title: d.requests,
      body: d.requestHint,
      icon: 'parcel',
    },
    { href: 'trips', title: d.trips, body: d.tripHint, icon: 'plane' },
    {
      href: 'bookings',
      title: d.bookings,
      body: d.bookingHint,
      icon: 'booking',
    },
  ];
  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">{d.eyebrow}</p>
          <h1>
            {d.headline}
            <span>{d.headlineSecond}</span>
          </h1>
          <p className="hero-intro">{d.intro}</p>
          <div className="hero-actions">
            <Link className="button" href={`/${locale}/delivery-requests/new`}>
              <Icon name="parcel" />
              {d.send}
              <Icon name="arrow" className="directional" />
            </Link>
            <Link
              className="button button-secondary"
              href={`/${locale}/trips/new`}
            >
              <Icon name="plane" />
              {d.carry}
            </Link>
          </div>
          <p className="corridor">
            <Icon name="globe" />
            {d.corridor}
          </p>
        </div>
        <div className="journey-art" aria-hidden="true">
          <div className="art-orbit" />
          <div className="art-sun" />
          <div className="art-route" />
          <span className="art-city art-paris">
            Paris<span>FR</span>
          </span>
          <span className="art-city art-casa">
            Casablanca<span>MA</span>
          </span>
          <div className="art-package">
            <Icon name="parcel" />
          </div>
          <div className="art-plane">
            <Icon name="plane" />
          </div>
          <div className="art-ticket">
            <span>FLYCO</span>
            <strong>
              FR <span>↔</span> MA
            </strong>
            <div className="ticket-lines" />
          </div>
        </div>
      </section>
      {authenticated && (
        <section className="home-section">
          <p className="eyebrow">Flyco</p>
          <h2>{d.activity}</h2>
          <p className="section-intro">{d.activityBody}</p>
          <div className="activity-grid">
            {activities.map((item) => (
              <Link
                className="activity-card"
                href={`/${locale}/${item.href}`}
                key={item.href}
              >
                <span className="icon-tile">
                  <Icon name={item.icon} />
                </span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <Icon name="arrow" className="directional" />
              </Link>
            ))}
          </div>
        </section>
      )}
      <section className="home-section">
        <p className="eyebrow">{d.corridor}</p>
        <h2>{d.how}</h2>
        <p className="section-intro">{d.howIntro}</p>
        <div className="steps-grid">
          {[
            [d.senderTitle, d.senderBody, 'parcel'],
            [d.travelerTitle, d.travelerBody, 'plane'],
            [d.connectTitle, d.connectBody, 'check'],
          ].map(([title, body, icon], index) => (
            <article key={title}>
              <span className="step-number">0{index + 1}</span>
              <Icon name={icon as IconName} />
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="trust-banner">
        <span className="icon-tile">
          <Icon name="shield" />
        </span>
        <div>
          <h2>{d.trustTitle}</h2>
          <p>{d.trustBody}</p>
        </div>
      </section>
    </div>
  );
}
