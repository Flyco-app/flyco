import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RouteDisplay, StatusBadge } from '@/components/ui/patterns';
import { SubmitButton } from '@/components/ui/submit-button';
import { safeLocale } from '@/lib/auth/validation';
import type { Locale } from '@/lib/auth/validation';
import { sendMessage, submitReport } from '@/modules/messaging/actions';
import { messagingCopy } from '@/modules/messaging/copy';
import { loadConversation } from '@/modules/messaging/queries';
import {
  conversationIdSchema,
  reportReasonSchema,
} from '@/modules/messaging/validation';

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const input = await params;
  const locale = safeLocale(input.locale);
  if (!conversationIdSchema.safeParse(input.id).success) notFound();
  const data = await loadConversation(locale, input.id);
  if (!data) notFound();
  const { conversation: c, messages, userId } = data;
  const d = messagingCopy[locale];
  const query = await searchParams;
  const format = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  return (
    <section className="space-y-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="eyebrow">{d.messages}</p>
            <h1>{c.counterparty_display_name}</h1>
          </div>
          <StatusBadge status={c.booking_status}>
            {c.booking_status}
          </StatusBadge>
        </div>
        <RouteDisplay origin={c.origin_name} destination={c.destination_name} />
        <p>
          {c.item_title} · {c.category_code}
        </p>
        <Link href={`/${locale}/bookings/${c.booking_id}`}>{d.booking}</Link>
      </header>
      {query.notice === 'sent' && (
        <p role="status" className="alert-success">
          {d.sent}
        </p>
      )}
      {query.notice === 'reported' && (
        <p role="status" className="alert-success">
          {d.reportSent}
        </p>
      )}
      <ol className="message-list" aria-live="polite">
        {messages.map((m) => (
          <li
            key={m.message_id}
            className={m.sender_id === userId ? 'message-own' : 'message-other'}
          >
            <div>
              <strong>{m.sender_display_name}</strong>
              <time dateTime={m.created_at}>{format(m.created_at)}</time>
            </div>
            <p className="whitespace-pre-wrap break-words">{m.body}</p>
            {m.sender_id !== userId && (
              <ReportForm
                locale={locale}
                d={d}
                conversation={c}
                messageId={m.message_id}
              />
            )}
          </li>
        ))}
      </ol>
      {c.can_send ? (
        <form
          action={sendMessage}
          className="space-y-3 rounded-xl border bg-white p-4"
        >
          <input type="hidden" name="locale" value={locale} />
          <input
            type="hidden"
            name="conversationId"
            value={c.conversation_id}
          />
          <label>
            {d.composer}
            <textarea
              className="field"
              name="body"
              required
              maxLength={2000}
              rows={4}
            />
          </label>
          <p className="text-sm text-muted-foreground">{d.messageLimit}</p>
          <SubmitButton className="button" locale={locale} type="submit">
            {d.send}
          </SubmitButton>
        </form>
      ) : (
        <p className="rounded-xl border p-4" role="status">
          {d.closed}
        </p>
      )}
      <div className="flex flex-wrap gap-4">
        <Link href={`/${locale}/messages`}>{d.back}</Link>
        <Link href={`/${locale}/messages/${c.conversation_id}`}>
          {d.refresh}
        </Link>
      </div>
      <ReportForm locale={locale} d={d} conversation={c} />
    </section>
  );
}

function ReportForm({
  locale,
  d,
  conversation,
  messageId,
}: {
  locale: Locale;
  d: (typeof messagingCopy)['en'];
  conversation: {
    booking_id: string;
    conversation_id: string;
    counterparty_id: string;
  };
  messageId?: string;
}) {
  return (
    <details className="destructive-section">
      <summary>{messageId ? d.reportMessage : d.report}</summary>
      <p>{d.reportHint}</p>
      <form action={submitReport} className="space-y-3">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="bookingId" value={conversation.booking_id} />
        <input
          type="hidden"
          name="conversationId"
          value={conversation.conversation_id}
        />
        <input
          type="hidden"
          name="reportedUserId"
          value={conversation.counterparty_id}
        />
        <input type="hidden" name="reportedMessageId" value={messageId ?? ''} />
        <label>
          {d.reason}
          <select className="field" name="reason" required>
            {reportReasonSchema.options.map((reason) => (
              <option key={reason} value={reason}>
                {d[reason]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {d.description}
          <textarea
            className="field"
            name="description"
            minLength={10}
            maxLength={2000}
            required
            rows={4}
          />
        </label>
        <SubmitButton
          locale={locale}
          className="button button-danger"
          type="submit"
        >
          {d.submitReport}
        </SubmitButton>
      </form>
    </details>
  );
}
