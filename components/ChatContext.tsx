import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import { startConversation, listMyConversations, type ConversationSummary } from "@/lib/conversations";

type ChatContextValue = {
  userId: string | null;
  conversations: ConversationSummary[];
  totalUnread: number;
  panelOpen: boolean;
  activeConversationId: string | null;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  openConversation: (conversationId: string) => void;
  openConversationWithArtist: (artistId: string) => Promise<void>;
  backToList: () => void;
  refreshConversations: () => Promise<void>;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const refreshConversations = useCallback(async () => {
    const { data } = await listMyConversations();
    setConversations((data as ConversationSummary[]) ?? []);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) { setConversations([]); return; }
    refreshConversations();
  }, [userId, refreshConversations]);

  // Realtime: refresh the list whenever a conversation this user is part of
  // changes (new message bumps updated_at, status changes, etc).
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`chat-bar-${userId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations", filter: `artist_id=eq.${userId}` }, refreshConversations)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations", filter: `artist_id=eq.${userId}` }, refreshConversations)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations", filter: `client_id=eq.${userId}` }, refreshConversations)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations", filter: `client_id=eq.${userId}` }, refreshConversations)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, refreshConversations]);

  const openPanel = useCallback(() => setPanelOpen(true), []);
  const closePanel = useCallback(() => { setPanelOpen(false); setActiveConversationId(null); }, []);
  const togglePanel = useCallback(() => setPanelOpen((v) => !v), []);
  const backToList = useCallback(() => setActiveConversationId(null), []);

  const openConversation = useCallback((conversationId: string) => {
    setActiveConversationId(conversationId);
    setPanelOpen(true);
  }, []);

  const openConversationWithArtist = useCallback(async (artistId: string) => {
    const { data, error } = await startConversation(artistId);
    if (error || !data) return;
    await refreshConversations();
    setActiveConversationId((data as { id: string }).id);
    setPanelOpen(true);
  }, [refreshConversations]);

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count ?? 0), 0);

  return (
    <ChatContext.Provider
      value={{
        userId,
        conversations,
        totalUnread,
        panelOpen,
        activeConversationId,
        openPanel,
        closePanel,
        togglePanel,
        openConversation,
        openConversationWithArtist,
        backToList,
        refreshConversations,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within a ChatProvider");
  return ctx;
}
