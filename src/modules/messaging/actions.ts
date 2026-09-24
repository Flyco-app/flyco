'use server';
import { redirect } from 'next/navigation';
import { assertTrustedServerActionOrigin } from '@/lib/auth/origin';
import { requireActiveAccount } from '@/lib/auth/session';
import { safeLocale } from '@/lib/auth/validation';
import { messageSchema, reportSchema } from './validation';

export async function sendMessage(form: FormData) {
  await assertTrustedServerActionOrigin();
  const locale = safeLocale(String(form.get('locale') ?? 'fr'));
  const parsed = messageSchema.safeParse({
    conversationId: form.get('conversationId'),
    body: form.get('body'),
  });
  if (!parsed.success) redirect(`/${locale}/messages?error=invalid`);
  const { client } = await requireActiveAccount(locale);
  const result = await client.rpc('send_conversation_message', {
    input_conversation_id: parsed.data.conversationId,
    input_body: parsed.data.body,
  });
  if (result.error)
    redirect(
      `/${locale}/messages/${parsed.data.conversationId}?error=${result.error.message.includes('rate limit') ? 'rate' : 'failed'}`,
    );
  redirect(`/${locale}/messages/${parsed.data.conversationId}?notice=sent`);
}
export async function submitReport(form: FormData) {
  await assertTrustedServerActionOrigin();
  const locale = safeLocale(String(form.get('locale') ?? 'fr'));
  const parsed = reportSchema.safeParse({
    bookingId: form.get('bookingId'),
    conversationId: form.get('conversationId'),
    reportedUserId: form.get('reportedUserId'),
    reportedMessageId: form.get('reportedMessageId') ?? '',
    reason: form.get('reason'),
    description: form.get('description'),
  });
  if (!parsed.success) redirect(`/${locale}/messages?error=invalid-report`);
  const { client } = await requireActiveAccount(locale);
  const result = await client.rpc('submit_safety_report', {
    input_booking_id: parsed.data.bookingId,
    input_conversation_id: parsed.data.conversationId,
    input_reported_user_id: parsed.data.reportedUserId,
    input_reported_message_id: parsed.data.reportedMessageId,
    input_reason_code: parsed.data.reason,
    input_description: parsed.data.description,
  });
  if (result.error)
    redirect(`/${locale}/messages/${parsed.data.conversationId}?error=report`);
  redirect(`/${locale}/messages/${parsed.data.conversationId}?notice=reported`);
}
