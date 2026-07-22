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

const STATUS_LABELS: Record<EnquiryStatus, string> = {
  new: "New",
  interested: "Interested",
  needs_details: "Needs more details",
  not_available: "Not available",
  closed: "Closed",
};

export function enquiryStatusLabel(status: string): string {
  return STATUS_LABELS[status as EnquiryStatus] ?? status;
}

/** Fetches (or lazily reads) the conversation created for an accepted enquiry. */
export async function getConversationForEnquiry(enquiryId: string) {
  return supabase.from("conversations").select("*").eq("enquiry_id", enquiryId).maybeSingle();
}

/** True if a phone number or email address appears in free text — used to warn, never to block or alter messages. */
const PHONE_PATTERN = /(?:\+?\d[\s.-]?){9,}/;
const EMAIL_PATTERN = /[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\])\s*[a-z0-9.-]+\s*(?:\.|\(dot\)|\[dot\])\s*[a-z]{2,}/i;

export function looksLikeContactLeak(text: string): boolean {
  return PHONE_PATTERN.test(text) || EMAIL_PATTERN.test(text);
}
