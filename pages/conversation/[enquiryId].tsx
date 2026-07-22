import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { stripOAuthHashIfPresent } from "@/lib/stripOAuthHash";
import { looksLikeContactLeak, type ConversationRow, type MessageRow, type ContactShareRequestRow } from "@/lib/conversations";
import Container from "@/components/Container";
import Logo from "@/components/Logo";
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

export default function ConversationPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
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
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadShareState = useCallback(async (conversationId: string, uid: string) => {
    const { data: requests } = await supabase
      .from("contact_share_requests")
      .select("*")
      .eq("conversation_id", conversationId)
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

    async function handleUser(u: { id: string } | null | undefined) {
      if (cancelled) return;
      if (!u) { router.replace("/signup"); return; }
      stripOAuthHashIfPresent();
      if (!router.isReady) return;
      const enquiryId = router.query.enquiryId as string;
      if (!enquiryId) return;

      setUserId(u.id);

      const { data: conv } = await supabase.from("conversations").select("*").eq("enquiry_id", enquiryId).maybeSingle();
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

      await loadShareState(conv.id, u.id);
      if (cancelled) return;
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data: { session } }) => handleUser(session?.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      handleUser(session?.user);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [router, router.isReady, router.query.enquiryId, loadShareState]);

  // Realtime: new messages and conversation status changes (e.g. blocked).
  useEffect(() => {
    if (!conversation) return;
    const channel = supabase
      .channel(`conversation-${conversation.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` },
        (payload) => setMessages((prev) => [...prev, payload.new as MessageRow]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations", filter: `id=eq.${conversation.id}` },
        (payload) => setConversation(payload.new as ConversationRow))
      .on("postgres_changes", { event: "*", schema: "public", table: "contact_share_requests", filter: `conversation_id=eq.${conversation.id}` },
        () => { if (userId) loadShareState(conversation.id, userId); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversation, userId, loadShareState]);

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
    if (!conversation || !userId) return;
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
      const { error } = await supabase.from("messages").insert({
        conversation_id: conversation.id,
        sender_id: userId,
        body: body.trim(),
        attachment_url: attachmentPath,
        attachment_type: attachmentType,
      });
      if (error) throw error;
      setBody("");
      setFile(null);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Could not send message", "error");
    } finally {
      setSending(false);
    }
  }

  async function requestContactShare() {
    if (!conversation || !userId || !partner) return;
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
    else if (conversation && userId) loadShareState(conversation.id, userId);
  }

  async function handleBlock() {
    if (!conversation || !userId) return;
    const { error } = await supabase.from("conversation_blocks").insert({ conversation_id: conversation.id, blocked_by: userId });
    if (error) showToast(error.message, "error");
    else { showToast("Conversation blocked.", "success"); setBlockOpen(false); }
  }

  async function handleReport() {
    if (!conversation || !userId || !partner || !reportReason.trim()) return;
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
    if (!conversation || !userId) return;
    const isArtist = conversation.artist_id === userId;
    const { error } = await supabase
      .from("conversations")
      .update({ status: isArtist ? "closed_by_artist" : "closed_by_client" })
      .eq("id", conversation.id);
    if (error) showToast(error.message, "error");
  }

  if (loading) {
    return <div className="min-h-screen bg-[var(--color-page)] flex items-center justify-center"><LoadingSpinner size="lg" label="Loading" /></div>;
  }

  if (notFound || !conversation) {
    return (
      <div className="min-h-screen bg-[var(--color-page)] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-lg font-semibold text-[var(--color-text)]">This conversation isn&apos;t available.</p>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">It may not have opened yet, or you may not have access to it.</p>
          <Button href="/" variant="primary" size="sm" className="mt-6">Back to home</Button>
        </div>
      </div>
    );
  }

  const isActive = conversation.status === "active";
  const isBlocked = conversation.status === "blocked";
  const myPendingIncoming = shareRequests.filter((r) => r.contact_owner_id === userId && r.status === "pending");
  const myOutgoingPending = shareRequests.some((r) => r.requested_by === userId && r.status === "pending");

  return (
    <div className="min-h-screen bg-[var(--color-page)] flex flex-col">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <Container className="flex flex-wrap gap-y-2 min-h-16 items-center justify-between py-2">
          <div className="flex items-center gap-3 min-w-0">
            <Logo size="sm" />
            <span className="text-[var(--color-border)]" aria-hidden="true">/</span>
            <span className="font-semibold text-[var(--color-text)] truncate max-w-[40vw] sm:max-w-none">{partner?.display_name || "Conversation"}</span>
            {!isActive && <Badge variant={isBlocked ? "error" : "neutral"}>{isBlocked ? "Blocked" : "Closed"}</Badge>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isActive && <Button size="sm" variant="ghost" onClick={closeConversation}>Close</Button>}
            <Button size="sm" variant="ghost" onClick={() => setReportOpen(true)}>Report</Button>
            {isActive && <Button size="sm" variant="ghost" onClick={() => setBlockOpen(true)}>Block</Button>}
          </div>
        </Container>
      </header>

      <Container className="flex-1 flex flex-col py-6 max-w-3xl">
        {/* Contact sharing panel */}
        <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          {contactInfo ? (
            <div>
              <p className="text-sm font-semibold text-[var(--color-text)]">Contact details shared</p>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                {[contactInfo.phone, contactInfo.email, contactInfo.website].filter(Boolean).join(" · ") || "No contact details on file."}
              </p>
            </div>
          ) : myPendingIncoming.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--color-text)]">{partner?.display_name || "They"} would like to see your contact details.</p>
              <div className="flex gap-2">
                <Button size="sm" variant="primary" onClick={() => respondToShareRequest(myPendingIncoming[0].id, "approved")}>Approve</Button>
                <Button size="sm" variant="outline" onClick={() => respondToShareRequest(myPendingIncoming[0].id, "declined")}>Decline</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--color-text-secondary)]">Contact details stay private until both sides agree to share.</p>
              {isActive && (
                <Button size="sm" variant="outline" disabled={myOutgoingPending} onClick={requestContactShare}>
                  {myOutgoingPending ? "Request sent" : "Request contact info"}
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
          className="flex-1 overflow-y-auto space-y-3 pr-1"
          style={{ maxHeight: "55vh" }}
        >
          {messages.map((m) => {
            const mine = m.sender_id === userId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] sm:max-w-[75%] rounded-[var(--radius-lg)] px-4 py-2.5 ${mine ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]"}`}>
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
                      <span aria-hidden="true">⚠ </span>This message may contain contact details. Sharing contact info happens through mutual consent above, not chat.
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
          <form onSubmit={handleSend} className="mt-4 flex items-end gap-3">
            <div className="flex-1">
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={2}
                placeholder="Type a message…"
                aria-label="Message"
              />
              {body && looksLikeContactLeak(body) && (
                <p className="mt-1 text-xs text-[var(--color-warning)]" role="status">
                  <span aria-hidden="true">⚠ </span>This looks like it contains a phone number or email — use the contact-sharing request instead.
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
              className="cursor-pointer rounded-[var(--radius-md)] border border-[var(--color-border)] p-2.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-soft)]
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
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01" /></svg>
            </label>
            <Button type="submit" variant="primary" disabled={sending || (!body.trim() && !file)}>Send</Button>
          </form>
        ) : (
          <p className="mt-4 text-center text-sm text-[var(--color-text-secondary)] py-3">
            {isBlocked ? "This conversation has been blocked and can no longer receive messages." : "This conversation is closed."}
          </p>
        )}
      </Container>

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
