import { useChat } from "@/components/ChatContext";
import ChatThread from "@/components/ChatThread";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function ChatWidget() {
  const {
    userId,
    conversations,
    totalUnread,
    panelOpen,
    activeConversationId,
    openPanel,
    closePanel,
    openConversation,
    backToList,
  } = useChat();

  if (!userId) return null;

  const active = conversations.find((c) => c.conversation_id === activeConversationId);

  return (
    <div className="fixed bottom-16 sm:bottom-0 right-4 sm:right-6 z-50 flex flex-col items-end">
      {panelOpen && (
        <div className="mb-0 w-[calc(100vw-2rem)] max-w-[360px] h-[70vh] max-h-[480px] rounded-t-[var(--radius-lg)] border border-b-0 border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)] flex flex-col overflow-hidden">
          {activeConversationId ? (
            <>
              <ChatThread conversationId={activeConversationId} userId={userId} compact onBack={backToList} />
            </>
          ) : (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] flex-shrink-0">
                <h2 className="text-sm font-bold text-[var(--color-text)]">Messaging</h2>
                <button type="button" onClick={closePanel} aria-label="Close messaging" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                    <p className="text-sm font-semibold text-[var(--color-text)]">No messages yet</p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Message an artist from their profile to start a conversation.</p>
                  </div>
                ) : (
                  <ul>
                    {conversations.map((c) => (
                      <li key={c.conversation_id}>
                        <button
                          type="button"
                          onClick={() => openConversation(c.conversation_id)}
                          className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[var(--color-primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent)]"
                        >
                          {c.partner_photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.partner_photo} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-[var(--color-primary-soft)] flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className={`text-sm truncate ${c.unread_count > 0 ? "font-bold text-[var(--color-text)]" : "font-medium text-[var(--color-text)]"}`}>{c.partner_name}</p>
                              <span className="text-[10px] text-[var(--color-text-secondary)] flex-shrink-0">{timeAgo(c.last_message_at)}</span>
                            </div>
                            <p className={`text-xs truncate mt-0.5 ${c.unread_count > 0 ? "font-semibold text-[var(--color-text)]" : "text-[var(--color-text-secondary)]"}`}>
                              {c.last_message_body || "Say hello…"}
                            </p>
                          </div>
                          {c.unread_count > 0 && (
                            <span className="mt-1 flex-shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[var(--color-accent)] text-white text-[10px] font-bold px-1">
                              {c.unread_count > 9 ? "9+" : c.unread_count}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={panelOpen ? closePanel : openPanel}
        className="flex items-center gap-2 rounded-t-[var(--radius-lg)] border border-b-0 border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 shadow-[var(--shadow-md)] hover:bg-[var(--color-primary-soft)] transition-colors"
        aria-expanded={panelOpen}
      >
        <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>
        <span className="text-sm font-semibold text-[var(--color-text)]">{active ? active.partner_name : "Messaging"}</span>
        {totalUnread > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[var(--color-accent)] text-white text-[10px] font-bold px-1">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
        <svg className={`w-3.5 h-3.5 text-[var(--color-text-secondary)] transition-transform ${panelOpen ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
      </button>
    </div>
  );
}
