import Link from 'next/link';
import {
  EmptyState,
  RouteDisplay,
  StatusBadge,
} from '@/components/ui/patterns';
import { safeLocale } from '@/lib/auth/validation';
import { messagingCopy } from '@/modules/messaging/copy';
import { loadConversations } from '@/modules/messaging/queries';

export default async function MessagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = safeLocale(raw);
  const d = messagingCopy[locale];
  const conversations = await loadConversations(locale);
  return (
    <section className="space-y-5">
      <header>
        <p className="eyebrow">{d.messages}</p>
        <h1>{d.inbox}</h1>
        <p>{d.inboxHint}</p>
      </header>
      {conversations.length === 0 ? (
        <EmptyState
          title={d.empty}
          description={d.emptyHint}
          href={`/${locale}/bookings`}
          action={d.booking}
          icon="message"
        />
      ) : (
        <ul className="card-grid">
          {conversations.map((c) => (
            <li className="listing-card" key={c.conversation_id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{c.counterparty_display_name}</strong>
                <StatusBadge status={c.booking_status}>
                  {c.booking_status}
                </StatusBadge>
              </div>
              <RouteDisplay
                origin={c.origin_name}
                destination={c.destination_name}
              />
              <p>{c.item_title}</p>
              {c.last_message_preview && (
                <p className="text-sm text-muted-foreground">
                  {c.last_message_preview}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                {c.unread_count > 0 ? (
                  <span className="status-badge status-warning">
                    {c.unread_count} {d.unread}
                  </span>
                ) : (
                  <span />
                )}
                <Link
                  className="button button-secondary"
                  href={`/${locale}/messages/${c.conversation_id}`}
                >
                  {d.open}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
