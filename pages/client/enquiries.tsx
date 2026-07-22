import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase, mapArtistRow, type ArtistProfile } from "@/lib/supabaseClient";
import { stripOAuthHashIfPresent } from "@/lib/stripOAuthHash";
import { enquiryStatusLabel, type EnquiryRow } from "@/lib/conversations";
import Container from "@/components/Container";
import Logo from "@/components/Logo";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";

const STATUS_BADGE: Record<string, "neutral" | "accent" | "success" | "warning" | "error"> = {
  new: "accent",
  interested: "success",
  needs_details: "warning",
  not_available: "error",
  closed: "neutral",
};

type EnquiryWithArtist = EnquiryRow & { artist: Pick<ArtistProfile, "fullName" | "stageName" | "profilePictureUrl"> | null };

export default function ClientEnquiriesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [enquiries, setEnquiries] = useState<EnquiryWithArtist[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function handleUser(u: { id: string } | null | undefined) {
      if (cancelled) return;
      if (!u) { router.replace({ pathname: "/signup", query: { role: "client", returnTo: "/client/enquiries" } }); return; }
      stripOAuthHashIfPresent();

      const { data: enqRows, error } = await supabase
        .from("enquiries")
        .select("*")
        .eq("client_id", u.id)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error || !enqRows || enqRows.length === 0) { setEnquiries([]); setLoading(false); return; }

      const artistIds = Array.from(new Set(enqRows.map((r) => r.artist_id)));
      const { data: artistRows } = await supabase.from("artists_public").select("*").in("id", artistIds);
      if (cancelled) return;
      const byId = new Map((artistRows ?? []).map((row) => [row.id, mapArtistRow(row)]));

      setEnquiries((enqRows as EnquiryRow[]).map((enq) => ({ ...enq, artist: byId.get(enq.artist_id) ?? null })));
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data: { session } }) => handleUser(session?.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      handleUser(session?.user);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-page)] flex items-center justify-center">
        <LoadingSpinner size="lg" label="Loading" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-page)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <Container className="flex h-16 items-center justify-between">
          <Logo size="md" />
          <Button href="/artists" variant="ghost" size="sm">Discover Artists</Button>
        </Container>
      </header>

      <Container className="py-10 sm:py-14 space-y-6">
        <div>
          <h1 className="text-3xl">Your enquiries</h1>
          <p className="mt-2 text-[var(--color-text-secondary)]">Track your sent enquiries and open conversations.</p>
        </div>

        {enquiries.length === 0 ? (
          <Card className="p-6">
            <EmptyState
              title="No enquiries sent yet"
              description="Contact an artist from their profile to get started."
              action={<Button href="/artists" variant="primary" size="sm">Discover artists</Button>}
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {enquiries.map((enq) => (
              <Card key={enq.id} className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--color-text)]">
                      {enq.artist?.stageName || enq.artist?.fullName || "Artist"}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                      {enq.event_type || "General enquiry"} · {[enq.location, enq.event_date].filter(Boolean).join(" · ") || new Date(enq.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={STATUS_BADGE[enq.status] ?? "neutral"}>{enquiryStatusLabel(enq.status)}</Badge>
                </div>

                {enq.status === "not_available" && (
                  <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
                    This artist isn&apos;t available for your event. Browse similar artists to keep looking.
                  </p>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                  {(enq.status === "interested" || enq.status === "needs_details") && (
                    <Button size="sm" variant="primary" href={`/conversation/${enq.id}`}>Open conversation</Button>
                  )}
                  {enq.status === "not_available" && (
                    <Button size="sm" variant="outline" href="/artists">Browse similar artists</Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}
