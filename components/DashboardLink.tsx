import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

/** Small "Dashboard" link shown wherever a signed-in artist might land outside the dashboard itself. Renders nothing for clients or signed-out visitors. */
export default function DashboardLink({ className = "" }: { className?: string }) {
  const [isArtist, setIsArtist] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check(uid: string | null | undefined) {
      if (!uid) { if (!cancelled) setIsArtist(false); return; }
      const { data } = await supabase.from("artists").select("id").eq("id", uid).maybeSingle();
      if (!cancelled) setIsArtist(!!data);
    }

    supabase.auth.getSession().then(({ data: { session } }) => check(session?.user?.id));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => check(session?.user?.id));
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  if (!isArtist) return null;

  return (
    <Link href="/dashboard" className={`flex-shrink-0 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] ${className}`}>
      Dashboard
    </Link>
  );
}
