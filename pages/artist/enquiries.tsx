import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { stripOAuthHashIfPresent } from "@/lib/stripOAuthHash";
import { enquiryStatusLabel, type EnquiryRow } from "@/lib/conversations";
import Container from "@/components/Container";
import Logo from "@/components/Logo";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useToast } from "@/components/Toast";

const STATUS_BADGE: Record<string, "neutral" | "accent" | "success" | "warning" | "error"> = {
  new: "accent",
  interested: "success",
  needs_details: "warning",
  not_available: "error",
  closed: "neutral",
};

export default function ArtistEnquiriesPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [enquiries, setEnquiries] = useState<EnquiryRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadEnquiries(artistId: string) {
    const { data } = await supabase
      .from("enquiries")
      .select("*")
      .eq("artist_id", artistId)
      .order("created_at", { ascending: false });
    setEnquiries((data as EnquiryRow[]) ?? []);
  }

  useEffect(() => {
    let cancelled = false;

    async function handleUser(u: { id: string } | null | undefined) {
      if (cancelled) return;
      if (!u) { router.replace({ pathname: "/signup", query: { role: "artist" } }); return; }
      stripOAuthHashIfPresent();
      const { data: artistRow } = await supabase.from("artists").select("id").eq("id", u.id).maybeSingle();
      if (cancelled) return;
      if (!artistRow) { router.replace("/create-profile"); return; }
      setUserId(u.id);
      await loadEnquiries(u.id);
      if (cancelled) return;
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data: { session } }) => handleUser(session?.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      handleUser(session?.user);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [router]);

  async function respond(enquiryId: string, status: "interested" | "needs_details" | "not_available") {
    if (!userId) return;
    setBusyId(enquiryId);
    const { error } = await supabase.from("enquiries").update({ status }).eq("id", enquiryId);
    if (error) {
      showToast(error.message, "error");
    } else {
      showToast(
        status === "not_available" ? "Client has been informed you're not available." : "Response sent — a private conversation is now open.",
        "success"
      );
      await loadEnquiries(userId);
    }
    setBusyId(null);
  }

  if (loading || !userId) {
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
          <Button href="/dashboard" variant="ghost" size="sm">Back to dashboard</Button>
        </Container>
      </header>

      <Container className="py-10 sm:py-14 space-y-6">
        <div>
          <h1 className="text-3xl">Enquiries</h1>
          <p className="mt-2 text-[var(--color-text-secondary)]">Respond to clients — accepting or requesting more details opens a private conversation.</p>
        </div>

        {!enquiries || enquiries.length === 0 ? (
          <Card className="p-6"><EmptyState title="No enquiries yet" description="When a client contacts you through your public profile, their enquiry will show up here." /></Card>
        ) : (
          <div className="space-y-4">
            {enquiries.map((enq) => (
              <Card key={enq.id} className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--color-text)]">{enq.event_type || "General enquiry"}</p>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                      {[enq.location, enq.event_date].filter(Boolean).join(" · ") || new Date(enq.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={STATUS_BADGE[enq.status] ?? "neutral"}>{enquiryStatusLabel(enq.status)}</Badge>
                </div>

                {enq.message && <p className="mt-4 text-sm text-[var(--color-text)]">{enq.message}</p>}

                <div className="mt-5 flex flex-wrap gap-3">
                  {enq.status === "new" ? (
                    <>
                      <Button size="sm" variant="primary" disabled={busyId === enq.id} onClick={() => respond(enq.id, "interested")}>
                        Interested
                      </Button>
                      <Button size="sm" variant="outline" disabled={busyId === enq.id} onClick={() => respond(enq.id, "needs_details")}>
                        Need more details
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busyId === enq.id} onClick={() => respond(enq.id, "not_available")}>
                        Not available
                      </Button>
                    </>
                  ) : (enq.status === "interested" || enq.status === "needs_details") ? (
                    <Button size="sm" variant="primary" href={`/conversation/${enq.id}`}>Open conversation</Button>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}
