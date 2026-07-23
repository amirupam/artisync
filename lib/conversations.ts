import { supabase } from "@/lib/supabaseClient";

export type EnquiryStatus = "new" | "interested" | "needs_details" | "not_available" | "closed";
export type ConversationStatus = "active" | "closed_by_artist" | "closed_by_client" | "blocked";

export type EnquiryRow = {
  id: string;
  artist_id: string;
  client_id: string;
  event_type: string;
  event_date: string | null;
  location: string;
  message: string;
  status: EnquiryStatus;
  created_at: string;
  responded_at: string | null;
};

export type ConversationRow = {
  id: string;
  enquiry_id: string;
  artist_id: string;
  client_id: string;
  status: ConversationStatus;
  created_at: string;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  attachment_url: string | null;
  attachment_type: string | null;
  flagged_contact_leak: boolean;
  created_at: string;
};

export type ContactShareRequestRow = {
  id: string;
  conversation_id: string;
  requested_by: string;
  contact_owner_id: string;
  status: "pending" | "approved" | "declined" | "revoked";
  created_at: string;
  responded_at: string | null;
};

/** True if a phone number or email address appears in free text — used to warn, never to block or alter messages. */
const PHONE_PATTERN = /(?:\+?\d[\s.-]?){9,}/;
const EMAIL_PATTERN = /[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\])\s*[a-z0-9.-]+\s*(?:\.|\(dot\)|\[dot\])\s*[a-z]{2,}/i;

export function looksLikeContactLeak(text: string): boolean {
  return PHONE_PATTERN.test(text) || EMAIL_PATTERN.test(text);
}

export type ConversationSummary = {
  conversation_id: string;
  partner_id: string;
  partner_name: string;
  partner_photo: string;
  status: ConversationStatus;
  last_message_body: string | null;
  last_message_at: string;
  unread_count: number;
};

/** Get-or-create a direct conversation with an artist — no enquiry/accept step. */
export async function startConversation(artistId: string) {
  return supabase.rpc("start_conversation", { p_artist_id: artistId }).single();
}

/** Fetches every conversation the current user is part of, with partner info, last message, and unread count — powers the chat bar. */
export async function listMyConversations() {
  return supabase.rpc("list_my_conversations");
}

/** Reopens a conversation either side previously closed (not blocked). */
export async function reopenConversation(conversationId: string) {
  return supabase.rpc("reopen_conversation", { p_conversation_id: conversationId }).single();
}

export async function markConversationRead(conversationId: string) {
  return supabase.rpc("mark_conversation_read", { p_conversation_id: conversationId });
}
