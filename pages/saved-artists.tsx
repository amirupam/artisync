import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase, mapArtistRow, type ArtistProfile } from "@/lib/supabaseClient";
import { stripOAuthHashIfPresent } from "@/lib/stripOAuthHash";
import Container from "@/components/Container";
import Logo from "@/components/Logo";
import Button from "@/components/Button";
import Input from "@/components/Input";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import SaveArtistButton from "@/components/SaveArtistButton";

type SavedEntry = { id: string; data: ArtistProfile };

export default function SavedArtistsPage() {
  const router = useRouter();
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<SavedEntry[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function handleUser(u: { id: string } | null | undefined) {
      if (cancelled) return;
      if (!u) { router.replace({ pathname: "/signup", query: { role: "client", returnTo: "/saved-artists" } }); return; }
      stripOAuthHashIfPresent();

      // Artists don't have a saved-artists list of their own.
      const { data: artistRow } = await supabase.from("artists").select("id").eq("id", u.id).maybeSingle();
      if (cancelled) return;
      if (artistRow) { router.replace("/dashboard"); return; }

      setClientId(u.id);
      const { data: savedRows, error: savedError } = await supabase
        .from("saved_artists")
        .select("artist_id")
        .eq("client_id", u.id)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (savedError) { setError(savedError.message); setLoading(false); return; }

      const artistIds = (savedRows ?? []).map((r) => r.artist_id);
      if (artistIds.length === 0) { setEntries([]); setLoading(false); return; }

      const { data: artistRows, error: artistsError } = await supabase
        .from("artists_public")
        .select("*")
        .in("id", artistIds);
      if (cancelled) return;
      if (artistsError) { setError(artistsError.message); setLoading(false); return; }

      const byId = new Map((artistRows ?? []).map((row) => [row.id, row]));
      setEntries(
        artistIds
          .filter((id) => byId.has(id))
          .map((id) => ({ id, data: mapArtistRow(byId.get(id)) }))
      );
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data: { session } }) => handleUser(session?.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      handleUser(session?.user);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [router]);

  function handleRemoved(artistId: string, saved: boolean) {
    if (!saved) setEntries((prev) => prev.filter((e) => e.id !== artistId));
  }

  const filtered = entries.filter((e) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const d = e.data;
    return [d.fullName, d.stageName, d.artForm, d.city, d.state].some((v) => v?.toLowerCase().includes(q));
  });

  return (
    <div className="min-h-screen bg-[var(--color-page)]">
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur">
        <Container className="flex h-16 items-center justify-between">
          <Logo size="sm" />
          <Button href="/artists" variant="ghost" size="sm">Discover Artists</Button>
        </Container>
      </header>

      <Container className="py-10">
        <h1 className="text-3xl">Saved artists</h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Artists you&rsquo;ve saved while browsing.</p>

        {loading ? (
          <div className="flex justify-center py-20"><LoadingSpinner size="lg" label="Loading saved artists" /></div>
        ) : error ? (
          <EmptyState title="Couldn't load saved artists" description={error} />
        ) : entries.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="No saved artists yet"
              description="Save artists while browsing so you can compare and contact them later."
              action={<Button href="/artists" variant="primary" size="md">Discover Artists</Button>}
            />
          </div>
        ) : (
          <>
            <div className="mt-6 max-w-md">
              <Input placeholder="Search within saved artists" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search within saved artists" />
            </div>

            {filtered.length === 0 ? (
              <div className="mt-8"><EmptyState title="No matches in your saved artists" description="Try a different search term." /></div>
            ) : (
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {filtered.map((e) => (
                  <div key={e.id} className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden">
                    <div className="relative h-24 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)]">
                      {e.data.coverBannerUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={e.data.coverBannerUrl} alt="" className="w-full h-full object-cover" />
                      )}
                      {e.data.profilePictureUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={e.data.profilePictureUrl} alt={e.data.fullName} className="absolute bottom-0 left-4 translate-y-1/2 w-12 h-12 rounded-full border-2 border-[var(--color-surface)] object-cover" />
                      )}
                    </div>
                    <div className="pt-8 px-4 pb-4">
                      {e.data.artForm && <span className="text-[10px] font-bold text-[var(--color-accent)] uppercase tracking-widest">{e.data.artForm}</span>}
                      <h3 className="font-bold text-[var(--color-text)] truncate">{e.data.fullName || e.data.stageName || "Artist"}</h3>
                      <p className="text-xs text-[var(--color-text-secondary)] truncate">{[e.data.city, e.data.state].filter(Boolean).join(", ")}</p>
                      <div className="mt-3 flex gap-2">
                        <Link href={`/artist/${e.id}`} className="flex-1 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-xs font-semibold min-h-[36px] px-3">
                          View Profile
                        </Link>
                        <SaveArtistButton artistId={e.id} clientId={clientId} className="!min-h-[36px] !px-3 !text-xs" onChange={(saved) => handleRemoved(e.id, saved)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Container>
    </div>
  );
}
