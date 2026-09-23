import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon, type IconName } from './icon';
import type { Locale } from '@/lib/auth/validation';
import { uiCopy } from '@/lib/ui/copy';

export function StatusBadge({
  status,
  children,
}: {
  status: string;
  children: ReactNode;
}) {
  const tone = ['published', 'accepted', 'verified'].includes(status)
    ? 'success'
    : ['proposed', 'pending', 'requires_input', 'under_review'].includes(status)
      ? 'warning'
      : ['rejected', 'revoked', 'cancelled'].includes(status)
        ? 'danger'
        : 'neutral';
  return <span className={`status-badge status-${tone}`}>{children}</span>;
}
export function EmptyState({
  title,
  description,
  href,
  action,
  icon = 'parcel',
}: {
  title: string;
  description: string;
  href: string;
  action: string;
  icon?: IconName;
}) {
  return (
    <div className="empty-state">
      <span className="icon-tile">
        <Icon name={icon} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      <Link className="button" href={href}>
        {action}
        <Icon name="arrow" className="directional" />
      </Link>
    </div>
  );
}
export function RouteDisplay({
  origin,
  destination,
}: {
  origin: string;
  destination: string;
}) {
  return (
    <span className="route-display">
      <bdi>{origin}</bdi>
      <Icon name="arrow" className="directional shrink-0" />
      <bdi>{destination}</bdi>
    </span>
  );
}
export function FormSection({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="form-section">
      <legend>
        <span className="step-number">{step}</span>
        {title}
      </legend>
      <p className="section-hint">{hint}</p>
      <div className="form-grid">{children}</div>
    </fieldset>
  );
}
export function DestructiveSection({
  label,
  locale,
  children,
  listing = false,
}: {
  label: string;
  locale: Locale;
  children: ReactNode;
  listing?: boolean;
}) {
  return (
    <details className="destructive-section">
      <summary>{label}</summary>
      <p>
        {listing ? uiCopy[locale].cancelListingHint : uiCopy[locale].cancelHint}
      </p>
      {children}
    </details>
  );
}
