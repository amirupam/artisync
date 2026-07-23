import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { stripOAuthHashIfPresent } from "@/lib/stripOAuthHash";
import Container from "@/components/Container";
import Logo from "@/components/Logo";
import Button from "@/components/Button";
import LoadingSpinner from "@/components/LoadingSpinner";
import NoIndexMeta from "@/components/NoIndexMeta";
import ChatThread from "@/components/ChatThread";

/** Full-page conversation view — mainly useful on mobile or for direct links; desktop users typically stay inside the chat bar (ChatWidget). */
export default function ConversationPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function handleUser(u: { id: string } | null | undefined) {
      if (cancelled) return;
      if (!u) { router.replace("/signup"); return; }
      stripOAuthHashIfPresent();
      setUserId(u.id);
      setChecked(true);
    }

    supabase.auth.getSession().then(({ data: { session } }) => handleUser(session?.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      handleUser(session?.user);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [router]);

  const conversationId = router.query.conversationId as string | undefined;

  if (!checked || !userId || !conversationId) {
    return (
      <div className="min-h-screen bg-[var(--color-page)] flex items-center justify-center">
        <NoIndexMeta />
        <LoadingSpinner size="lg" label="Loading" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-page)] flex flex-col">
      <NoIndexMeta />
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)] flex-shrink-0">
        <Container className="flex h-14 items-center justify-between">
          <Logo size="sm" />
          <Button href="/artists" variant="ghost" size="sm">Back to Artists</Button>
        </Container>
      </header>
      <div className="flex-1">
        <ChatThread conversationId={conversationId} userId={userId} />
      </div>
    </div>
  );
}
