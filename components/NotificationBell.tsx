import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { listMyPendingApplications, type PendingApplicationNotification } from "@/lib/jobs";
import { useChat } from "@/components/ChatContext";

const POLL_MS = 45000;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/** Client-side notification bell — new job applicants and new messages, separate from the chat bar itself. */
export default function NotificationBell() {
  const router = useRouter();
  const { conversations, openConversation } = useChat();
  const [open, setOpen] = useState(false);
  const [applications, setApplications] = useState<PendingApplicationNotification[]>([]);

  const load = useCallback(async () => {
    const { data } = await listMyPendingApplications();
    setApplications((data as PendingApplicationNotification[]) ?? []);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const unreadConversations = conversations.filter((c) => c.unread_count > 0);
  const total = applications.length + unreadConversations.length;

  function goToJob(jobId: string) {
    setOpen(false);
    router.push(`/my-jobs?job=${jobId}`);
  }

  function goToConversation(conversationId: string) {
    setOpen(false);
    openConversation(conversationId);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); if (!open) load(); }}
        aria-expanded={open}
        aria-label="Notifications"
        className="relative p-2 rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-text)]
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {total > 0 && (
          <span className="absolute top-0.5 right-0.5 inline-flex items-center justify-center min-w-[16px] h-[16px] rounded-full bg-[var(--color-accent)] text-white text-[10px] font-bold px-1">
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-md)] z-20 py-2">
            {total === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-[var(--color-text-secondary)]">No new notifications.</p>
            ) : (
              <>
                {applications.length > 0 && (
                  <div>
                    <p className="px-4 pt-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">New applicants</p>
                    {applications.map((a) => (
                      <button
                        key={a.application_id}
                        type="button"
                        onClick={() => goToJob(a.job_id)}
                        className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-[var(--color-primary-soft)]"
                      >
                        {a.artist_photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.artist_photo} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-soft)] flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[var(--color-text)]"><span className="font-semibold">{a.artist_name}</span> applied to <span className="font-semibold">{a.job_title}</span></p>
                          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{timeAgo(a.created_at)} ago</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {unreadConversations.length > 0 && (
                  <div>
                    <p className="px-4 pt-2 pb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">New messages</p>
                    {unreadConversations.map((c) => (
                      <button
                        key={c.conversation_id}
                        type="button"
                        onClick={() => goToConversation(c.conversation_id)}
                        className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-[var(--color-primary-soft)]"
                      >
                        {c.partner_photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.partner_photo} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-soft)] flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--color-text)]">{c.partner_name}</p>
                          <p className="text-xs text-[var(--color-text-secondary)] truncate mt-0.5">{c.last_message_body || "New message"}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
