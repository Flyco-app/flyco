import 'server-only';
import { requireAccountHistoryAccess } from '@/lib/auth/session';
import type { Locale } from '@/lib/auth/validation';

export type ConversationSummary = {
  conversation_id: string;
  booking_id: string;
  booking_status: string;
  counterparty_id: string;
  counterparty_display_name: string;
  origin_name: string;
  destination_name: string;
  item_title: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
};
export type Conversation = {
  conversation_id: string;
  booking_id: string;
  booking_status: string;
  counterparty_id: string;
  counterparty_display_name: string;
  origin_name: string;
  destination_name: string;
  item_title: string;
  category_code: string;
  can_send: boolean;
};
export type Message = {
  message_id: string;
  sender_id: string;
  sender_display_name: string;
  body: string;
  created_at: string;
};

export async function loadConversations(locale: Locale) {
  const { client } = await requireAccountHistoryAccess(locale);
  const result = await client.rpc('get_my_conversations', { input_limit: 50 });
  if (result.error) throw new Error('Unable to load conversations.');
  return result.data as ConversationSummary[];
}
export async function loadConversation(locale: Locale, id: string) {
  const { client, user } = await requireAccountHistoryAccess(locale);
  const [context, messages] = await Promise.all([
    client.rpc('get_conversation', { input_conversation_id: id }),
    client.rpc('get_conversation_messages', {
      input_conversation_id: id,
      input_limit: 50,
      input_before: null,
      input_before_id: null,
    }),
  ]);
  if (context.error || messages.error)
    throw new Error('Unable to load conversation.');
  const row = (context.data as Conversation[])[0];
  if (!row) return null;
  const marked = await client.rpc('mark_conversation_read', {
    input_conversation_id: id,
    input_through_message_id:
      (messages.data as Message[])[0]?.message_id ?? null,
  });
  if (marked.error) throw new Error('Unable to update unread state.');
  return {
    conversation: row,
    messages: (messages.data as Message[]).reverse(),
    userId: user.id,
  };
}
export async function loadBookingConversation(
  locale: Locale,
  bookingId: string,
) {
  const { client } = await requireAccountHistoryAccess(locale);
  const result = await client.rpc('get_booking_conversation', {
    input_booking_id: bookingId,
  });
  if (result.error) throw new Error('Unable to load booking conversation.');
  return result.data as string | null;
}
