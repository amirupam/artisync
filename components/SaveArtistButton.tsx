import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";

export default function SaveArtistButton({
  artistId,
  clientId,
  className = "",
}: {
  artistId: string;
  clientId: string | null;
  className?: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!clientId) { setChecking(false); return; }
    let cancelled = false;
    supabase.from("saved_artists").select("artist_id").eq("client_id", clientId).eq("artist_id", artistId).maybeSingle()
      .then(({ data }) => { if (!cancelled) { setSaved(!!data); setChecking(false); } });
    return () => { cancelled = true; };
  }, [clientId, artistId]);

  async function toggle() {
    if (!clientId) {
      router.push({ pathname: "/signup", query: { role: "client", returnTo: router.asPath } });
      return;
    }
    setBusy(true);
    try {
      if (saved) {
        await supabase.from("saved_artists").delete().eq("client_id", clientId).eq("artist_id", artistId);
        setSaved(false);
      } else {
        await supabase.from("saved_artists").insert({ client_id: clientId, artist_id: artistId });
        setSaved(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={checking || busy}
      aria-pressed={saved}
      className={`inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-4 py-2.5 text-sm font-semibold transition-colors min-h-[44px]
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]
        ${saved ? "bg-[var(--color-accent-soft)] border-[var(--color-accent)] text-[var(--color-accent-hover)]" : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-accent)]"}
        ${className}`}
    >
      <svg className="w-4 h-4" fill={saved ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
      {saved ? "Saved" : "Save"}
    </button>
  );
}
