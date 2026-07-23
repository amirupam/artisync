import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  looksLikeContactLeak,
  markConversationRead,
  reopenConversation,
  type ConversationRow,
  type MessageRow,
  type ContactShareRequestRow,
} from "@/lib/conversations";
import { useChat } from "@/components/ChatContext";
import Button from "@/components/Button";
import Textarea from "@/components/Textarea";
import Input from "@/components/Input";
import Modal from "@/components/Modal";
import Badge from "@/components/Badge";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useToast } from "@/components/Toast";

const CHAT_BUCKET = "chat-attachments";

type Partner = { user_id: string; display_name: string; profile_picture_url: string };
type ContactInfo = { phone: string; email: string; website: string; preferred_contact_method: string };

/** Shared message-thread UI — used both by the full-page /conversation/[id] route and the ChatWidget panel. */
export default function ChatThread({
  conversationId,
  userId,
  compact = false,
  onBack,
}: {
  conversationId: string;
  userId: string;
  compact?: boolean;
  onBack?: () => void;
}) {
  const { showToast } = useToast();
  const { refreshConversations } = useChat();
  const [conversation, setConversation] = useState<ConversationRow | null>(null);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [shareRequests, setShareRequests] = useState<ContactShareRequestRow[]>([]);
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadShareState = useCallback(async (convId: string, uid: string) => {
    const { data: requests } = await supabase
      .from("contact_share_requests")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: false });
    setShareRequests((requests as ContactShareRequestRow[]) ?? []);

    const approvedForMe = (requests as ContactShareRequestRow[] | null)?.find(
      (r) => r.requested_by === uid && r.status === "approved"
    );
    if (approvedForMe) {
      const { data } = await supabase.rpc("get_contact_info", { p_owner_id: approvedForMe.contact_owner_id });
      const row = Array.isArray(data) ? data[0] : data;
      if (row) setContactInfo(row as ContactInfo);
    } else {
      setContactInfo(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setNotFound(false);

      const { data: conv } = await supabase.from("conversations").select("*").eq("id", conversationId).maybeSingle();
      if (cancelled) return;
      if (!conv) { setNotFound(true); setLoading(false); return; }
      setConversation(conv as ConversationRow);

      const { data: partnerRows } = await supabase.rpc("get_conversation_partner", { p_conversation_id: conv.id });
      if (cancelled) return;
      const partnerRow = Array.isArray(partnerRows) ? partnerRows[0] : partnerRows;
      if (partnerRow) setPartner(partnerRow as Partner);

      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setMessages((msgs as MessageRow[]) ?? []);

      await loadShareState(conv.id, userId);
      if (cancelled) return;
      await markConversationRead(conv.id);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [conversationId, userId, loadShareState]);

  // Realtime: new messages and conversation status changes (e.g. blocked).
  useEffect(() => {
    if (!conversation) return;
    const channel = supabase
      .channel(`conversation-${conversation.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          const incoming = payload.new as MessageRow;
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
          markConversationRead(conversation.id);
          refreshConversations();
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations", filter: `id=eq.${conversation.id}` },
        (payload) => setConversation(payload.new as ConversationRow))
      .on("postgres_changes", { event: "*", schema: "public", table: "contact_share_requests", filter: `conversation_id=eq.${conversation.id}` },
        () => loadShareState(conversation.id, userId))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversation, userId, loadShareState, refreshConversations]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Resolve signed URLs for any attachments as messages arrive.
  useEffect(() => {
    const pending = messages.filter((m) => m.attachment_url && !attachmentUrls[m.attachment_url]);
    if (pending.length === 0) return;
    (async () => {
      const entries = await Promise.all(
        pending.map(async (m) => {
          const { data } = await supabase.storage.from(CHAT_BUCKET).createSignedUrl(m.attachment_url as string, 3600);
          return [m.attachment_url as string, data?.signedUrl ?? ""] as const;
        })
      );
      setAttachmentUrls((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    })();
  }, [messages, attachmentUrls]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    await sendMessage();
  }

  async function sendMessage() {
    if (!conversation) return;
    if (!body.trim() && !file) return;
    if (file && file.size > 10 * 1024 * 1024) {
      showToast("Attachments must be 10MB or smaller.", "error");
      return;
    }
    setSending(true);
    try {
      let attachmentPath: string | null = null;
      let attachmentType: string | null = null;
      if (file) {
        const path = `${conversation.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from(CHAT_BUCKET).upload(path, file);
        if (uploadError) throw uploadError;
        attachmentPath = path;
        attachmentType = file.type || "application/octet-stream";
      }
      const { data: inserted, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversation.id,
          sender_id: userId,
          body: body.trim(),
          attachment_url: attachmentPath,
          attachment_type: attachmentType,
        })
        .select()
        .single();
      if (error) throw error;
      // Show it immediately rather than waiting on the realtime echo — the
      // realtime listener below dedupes by id so this never double-adds.
      if (inserted) {
        setMessages((prev) => (prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted as MessageRow]));
      }
      setBody("");
      setFile(null);
      refreshConversations();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Could not send message", "error");
    } finally {
      setSending(false);
    }
  }

  async function requestContactShare() {
    if (!conversation || !partner) return;
    const { error } = await supabase.from("contact_share_requests").insert({
      conversation_id: conversation.id,
      requested_by: userId,
      contact_owner_id: partner.user_id,
    });
    if (error) showToast(error.message, "error");
    else { showToast("Requested — waiting for their approval.", "success"); loadShareState(conversation.id, userId); }
  }

  async function respondToShareRequest(id: string, status: "approved" | "declined") {
    const { error } = await supabase.from("contact_share_requests").update({ status }).eq("id", id);
    if (error) showToast(error.message, "error");
    else if (conversation) loadShareState(conversation.id, userId);
  }

  async function handleBlock() {
    if (!conversation) return;
    const { error } = await supabase.from("conversation_blocks").insert({ conversation_id: conversation.id, blocked_by: userId });
    if (error) showToast(error.message, "error");
    else { showToast("Conversation blocked.", "success"); setBlockOpen(false); }
  }

  async function handleReport() {
    if (!conversation || !partner || !reportReason.trim()) return;
    const { error } = await supabase.from("reports").insert({
      conversation_id: conversation.id,
      reported_by: userId,
      reported_user_id: partner.user_id,
      reason: reportReason.trim(),
      details: reportDetails.trim(),
    });
    if (error) showToast(error.message, "error");
    else { showToast("Report submitted — our team will review it.", "success"); setReportOpen(false); setReportReason(""); setReportDetails(""); }
  }

  async function closeConversation() {
    if (!conversation) return;
    const isArtist = conversation.artist_id === userId;
    const { error } = await supabase
      .from("conversations")
      .update({ status: isArtist ? "closed_by_artist" : "closed_by_client" })
      .eq("id", conversation.id);
    if (error) showToast(error.message, "error");
    setMenuOpen(false);
  }

  async function handleReopen() {
    if (!conversation) return;
    const { data, error } = await reopenConversation(conversation.id);
    if (error) { showToast(error.message, "error"); return; }
    if (data) setConversation(data as ConversationRow);
  }

  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  if (loading) {
    return <div className={`flex items-center justify-center ${compact ? "h-full" : "min-h-screen bg-[var(--color-page)]"}`}><LoadingSpinner size={compact ? "md" : "lg"} label="Loading" /></div>;
  }

  if (notFound || !conversation) {
    return (
      <div className={`flex items-center justify-center px-4 text-center ${compact ? "h-full" : "min-h-screen bg-[var(--color-page)]"}`}>
        <div>
          <p className="text-sm font-semibold text-[var(--color-text)]">This conversation isn&apos;t available.</p>
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">It may not have opened yet, or you may not have access to it.</p>
        </div>
      </div>
    );
  }

  const isActive = conversation.status === "active";
  const isBlocked = conversation.status === "blocked";
  const myPendingIncoming = shareRequests.filter((r) => r.contact_owner_id === userId && r.status === "pending");
  const myOutgoingPending = shareRequests.some((r) => r.requested_by === userId && r.status === "pending");

  return (
    <div className={compact ? "flex flex-col h-full" : "min-h-screen bg-[var(--color-page)] flex flex-col"}>
      {/* Header */}
      <div className={compact
        ? "flex items-center justify-between gap-2 px-3 py-2.5 border-b border-[var(--color-border)] flex-shrink-0"
        : "border-b border-[var(--color-border)] bg-[var(--color-surface)]"
      }>
        <div className={compact ? "flex items-center gap-2 min-w-0" : "max-w-3xl mx-auto flex flex-wrap gap-y-2 min-h-16 items-center justify-between py-2 px-4"}>
          <div className="flex items-center gap-2 min-w-0">
            {onBack && (
              <button type="button" onClick={onBack} aria-label="Back to conversations" className="flex-shrink-0 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
            )}
            {partner?.profile_picture_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={partner.profile_picture_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[var(--color-primary-soft)] flex-shrink-0" />
            )}
            <span className="font-semibold text-sm text-[var(--color-text)] truncate">{partner?.display_name || "Conversation"}</span>
            {!isActive && <Badge variant={isBlocked ? "error" : "neutral"}>{isBlocked ? "Blocked" : "Closed"}</Badge>}
          </div>
          <div className="relative flex-shrink-0">
            <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-label="Conversation options" className="p-1.5 rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-soft)]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zm0 6a.75.75 0 110-1.5.75.75 0 010 1.5zm0 6a.75.75 0 110-1.5.75.75 0 010 1.5z" /></svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-md)] z-10 py-1">
                {isActive && <button type="button" onClick={closeConversation} className="w-full text-left px-3 py-2 text-xs text-[var(--color-text)] hover:bg-[var(--color-primary-soft)]">Close conversation</button>}
                {isActive && <button type="button" onClick={() => { setBlockOpen(true); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs text-[var(--color-text)] hover:bg-[var(--color-primary-soft)]">Block</button>}
                <button type="button" onClick={() => { setReportOpen(true); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs text-[var(--color-text)] hover:bg-[var(--color-primary-soft)]">Report</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={compact ? "flex-1 flex flex-col min-h-0" : "flex-1 flex flex-col py-6 max-w-3xl mx-auto w-full px-4"}>
        {/* Contact sharing panel */}
        <div className={compact ? "px-3 py-2 border-b border-[var(--color-border)] flex-shrink-0" : "mb-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"}>
          {contactInfo ? (
            <div>
              <p className={compact ? "text-xs font-semibold text-[var(--color-text)]" : "text-sm font-semibold text-[var(--color-text)]"}>Contact details shared</p>
              <p className={compact ? "text-xs text-[var(--color-text-secondary)] mt-0.5" : "text-sm text-[var(--color-text-secondary)] mt-1"}>
                {[contactInfo.phone, contactInfo.email, contactInfo.website].filter(Boolean).join(" · ") || "No contact details on file."}
              </p>
            </div>
          ) : myPendingIncoming.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[var(--color-text)]">{partner?.display_name || "They"} would like your contact details.</p>
              <div className="flex gap-2">
                <Button size="sm" variant="primary" onClick={() => respondToShareRequest(myPendingIncoming[0].id, "approved")}>Approve</Button>
                <Button size="sm" variant="outline" onClick={() => respondToShareRequest(myPendingIncoming[0].id, "declined")}>Decline</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[var(--color-text-secondary)]">Contact details stay private until both sides agree.</p>
              {isActive && (
                <Button size="sm" variant="outline" disabled={myOutgoingPending} onClick={requestContactShare}>
                  {myOutgoingPending ? "Requested" : "Request contact info"}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-label="Conversation messages"
          className={compact ? "flex-1 overflow-y-auto space-y-2.5 px-3 py-3 min-h-0" : "flex-1 overflow-y-auto space-y-3 pr-1"}
          style={compact ? undefined : { maxHeight: "55vh" }}
        >
          {messages.map((m) => {
            const mine = m.sender_id === userId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] ${compact ? "" : "sm:max-w-[75%]"} rounded-[var(--radius-lg)] px-3.5 py-2 ${mine ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]"}`}>
                  <span className="sr-only">{mine ? "You" : partner?.display_name || "They"} said, at {new Date(m.created_at).toLocaleString()}:</span>
                  {m.body && <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>}
                  {m.attachment_url && (
                    attachmentUrls[m.attachment_url] ? (
                      m.attachment_type?.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={attachmentUrls[m.attachment_url]} alt="Shared attachment" className="mt-2 max-h-52 rounded-[var(--radius-md)]" />
                      ) : (
                        <a href={attachmentUrls[m.attachment_url]} target="_blank" rel="noreferrer" className="mt-2 block text-xs underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">Download attachment</a>
                      )
                    ) : (
                      <p className="mt-2 text-xs opacity-70">Loading attachment…</p>
                    )
                  )}
                  {m.flagged_contact_leak && (
                    <p className={`mt-2 text-xs ${mine ? "text-white/80" : "text-[var(--color-warning)]"}`}>
                      <span aria-hidden="true">⚠ </span>May contain contact details — use contact-sharing above instead.
                    </p>
                  )}
                  <p className={`mt-1 text-[10px] ${mine ? "text-white/60" : "text-[var(--color-text-secondary)]"}`} aria-hidden="true">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })}
          {messages.length === 0 && (
            <p className="text-center text-sm text-[var(--color-text-secondary)] py-10">Say hello — start the conversation.</p>
          )}
        </div>

        {/* Composer */}
        {isActive ? (
          <form onSubmit={handleSend} className={compact ? "flex items-end gap-2 px-3 py-2.5 border-t border-[var(--color-border)] flex-shrink-0" : "mt-4 flex items-end gap-3"}>
            <div className="flex-1 min-w-0">
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={handleComposerKeyDown}
                rows={compact ? 1 : 2}
                placeholder="Type a message…"
                aria-label="Message"
              />
              {body && looksLikeContactLeak(body) && (
                <p className="mt-1 text-xs text-[var(--color-warning)]" role="status">
                  <span aria-hidden="true">⚠ </span>Looks like a phone number or email — use contact-sharing instead.
                </p>
              )}
              {file && (
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  Attached: {file.name}{" "}
                  <button type="button" className="underline hover:text-[var(--color-text)]" onClick={() => setFile(null)}>Remove</button>
                </p>
              )}
            </div>
            <label
              className="cursor-pointer rounded-[var(--radius-md)] border border-[var(--color-border)] p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-soft)] flex-shrink-0
                has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-accent)]"
            >
              <span className="sr-only">Attach a file</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                aria-label="Attach a file"
              />
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01" /></svg>
            </label>
            <Button type="submit" variant="primary" size={compact ? "sm" : "md"} disabled={sending || (!body.trim() && !file)}>Send</Button>
          </form>
        ) : isBlocked ? (
          <p className="text-center text-xs text-[var(--color-text-secondary)] py-3 px-3">This conversation has been blocked.</p>
        ) : (
          <div className="flex flex-col items-center gap-2 py-3 px-3">
            <p className="text-xs text-[var(--color-text-secondary)]">This conversation is closed.</p>
            <Button size="sm" variant="outline" onClick={handleReopen}>Reopen conversation</Button>
          </div>
        )}
      </div>

      <Modal open={blockOpen} onClose={() => setBlockOpen(false)} title="Block this conversation?">
        <p className="text-sm text-[var(--color-text-secondary)]">Neither of you will be able to send new messages. This can&apos;t be undone.</p>
        <div className="mt-6 flex gap-3">
          <Button variant="primary" onClick={handleBlock}>Block</Button>
          <Button variant="ghost" onClick={() => setBlockOpen(false)}>Cancel</Button>
        </div>
      </Modal>

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Report this conversation">
        <div className="space-y-4">
          <Input label="Reason" value={reportReason} onChange={(e) => setReportReason(e.target.value)} placeholder="e.g. Harassment, spam, scam" />
          <Textarea label="Details" optional value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} rows={3} />
          <Button variant="primary" fullWidth disabled={!reportReason.trim()} onClick={handleReport}>Submit report</Button>
        </div>
      </Modal>
    </div>
  );
}
