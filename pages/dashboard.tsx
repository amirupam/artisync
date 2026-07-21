import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase, mapArtistRow, type ArtistProfile } from "@/lib/supabaseClient";
import { getArtistProfileCompleteness } from "@/lib/artistProfileCompleteness";
import { stripOAuthHashIfPresent } from "@/lib/stripOAuthHash";
import Container from "@/components/Container";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Logo from "@/components/Logo";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";

type Enquiry = {
  id: string;
  event_type: string;
  event_date: string | null;
  location: string;
  status: string;
  created_at: string;
};

type Action = { title: string; description: string; href: string; icon: React.ReactNode };

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] ${className}`} />;
}

export default function DashboardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ArtistProfile | null>(null);
  const [enquiries, setEnquiries] = useState<Enquiry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingStatus, setTogglingStatus] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function handleUser(u: { id: string } | null | undefined) {
      if (cancelled) return;
      if (!u) { router.replace({ pathname: "/signup", query: { role: "artist" } }); return; }
      stripOAuthHashIfPresent();
      setUserId(u.id);
      const { data: d } = await supabase.from("artists").select("*").eq("id", u.id).maybeSingle();
      if (cancelled) return;
      if (!d) { router.replace("/create-profile"); return; }
      setProfile(mapArtistRow(d));

      const { data: enq } = await supabase
        .from("enquiries")
        .select("id, event_type, event_date, location, status, created_at")
        .eq("artist_id", u.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (cancelled) return;
      setEnquiries(enq ?? []);
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data: { session } }) => handleUser(session?.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      handleUser(session?.user);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [router]);

  async function togglePublishStatus() {
    if (!userId || !profile) return;
    setTogglingStatus(true);
    const nextStatus = profile.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("artists").update({ status: nextStatus }).eq("id", userId);
    if (!error) setProfile((p) => (p ? { ...p, status: nextStatus } : p));
    setTogglingStatus(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (loading || !profile || !userId) {
    return (
      <div className="min-h-screen bg-[var(--color-page)]">
        <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <Container className="flex h-16 items-center"><Logo size="md" /></Container>
        </header>
        <Container className="py-10 sm:py-14 space-y-6">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-5 w-96" />
          <Skeleton className="h-32 w-full" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
          </div>
        </Container>
      </div>
    );
  }

  const completeness = getArtistProfileCompleteness(profile);

  const actions: Action[] = [
    { title: "Add Portfolio", description: "Upload performance photos and videos.", href: "/create-profile?step=3", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.19 2.19 0 00-1.854-1.025h-3.196a2.19 2.19 0 00-1.854 1.025l-.822 1.316zM16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /> },
    { title: "Update Availability", description: "Keep your booking status current.", href: "/create-profile?step=4", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /> },
    { title: "Edit Pricing", description: "Update your rates and pricing details.", href: "/create-profile?step=4", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" /> },
    { title: "Preview Profile", description: "See exactly what clients see when they find you.", href: `/artist/${userId}`, icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /> },
    { title: "Manage Enquiries", description: "Review enquiries from clients.", href: "#enquiries", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /> },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-page)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <Container className="flex h-16 items-center justify-between">
          <Logo size="md" />
          <Button href="/" variant="ghost" size="sm">Back to home</Button>
        </Container>
      </header>

      <Container className="py-10 sm:py-14 space-y-8">
        <div>
          <h1 className="text-3xl">Welcome back, {profile.fullName || profile.stageName || "Artist"}</h1>
          <p className="mt-2 text-[var(--color-text-secondary)]">Manage your profile, portfolio, availability, and client enquiries.</p>
        </div>

        {/* 1. Profile status */}
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[var(--color-text)]">Profile status</h2>
            <Badge variant={profile.status === "published" ? "success" : "warning"}>
              {profile.status === "published" ? "Published" : "Draft"}
            </Badge>
          </div>
          <div className="mt-4 h-2.5 w-full rounded-full bg-[var(--color-primary-soft)] overflow-hidden">
            <div className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500" style={{ width: `${completeness.percentage}%` }}
              role="progressbar" aria-valuenow={completeness.percentage} aria-valuemin={0} aria-valuemax={100} />
          </div>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{completeness.percentage}% complete</p>
          {!completeness.publishable && (
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Missing: {completeness.missingFields.join(", ")}</p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button href={`/artist/${userId}`} variant="outline" size="sm">View Public Profile</Button>
            <Button href="/create-profile" variant="outline" size="sm">Edit Profile</Button>
            <Button type="button" variant="ghost" size="sm" onClick={togglePublishStatus} disabled={togglingStatus}>
              {togglingStatus ? "Updating…" : profile.status === "published" ? "Unpublish" : "Publish profile"}
            </Button>
          </div>
        </Card>

        {/* 2. Quick actions */}
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text)] mb-4">Quick actions</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {actions.map((action) => (
              <Card key={action.title} href={action.href} className="p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{action.icon}</svg>
                </div>
                <h3 className="mt-4 text-base font-semibold text-[var(--color-text)]">{action.title}</h3>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{action.description}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* 3. Portfolio preview */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[var(--color-text)]">Portfolio</h2>
            <div className="flex gap-3">
              <Button href="/create-profile?step=3" variant="ghost" size="sm">Add new</Button>
              <Button href="/create-profile?step=3" variant="ghost" size="sm">Edit / remove</Button>
            </div>
          </div>
          {profile.performanceImageUrls.length === 0 ? (
            <Card className="p-6">
              <EmptyState
                title="No portfolio media yet"
                description="Add photos or videos so clients can see your work."
                action={<Button href="/create-profile?step=3" variant="primary" size="sm">Add Portfolio</Button>}
              />
            </Card>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {profile.performanceImageUrls.slice(0, 6).map((url) => (
                <div key={url} className="aspect-square rounded-[var(--radius-md)] overflow-hidden bg-[var(--color-primary-soft)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. Enquiries */}
        <div id="enquiries">
          <h2 className="text-base font-semibold text-[var(--color-text)] mb-4">Recent enquiries</h2>
          {!enquiries || enquiries.length === 0 ? (
            <Card className="p-6">
              <EmptyState
                title="No enquiries yet"
                description="When a client contacts you through your public profile, their enquiry will show up here."
              />
            </Card>
          ) : (
            <Card className="divide-y divide-[var(--color-border)]">
              {enquiries.map((enq) => (
                <div key={enq.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">{enq.event_type || "General enquiry"}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      {[enq.location, enq.event_date].filter(Boolean).join(" · ") || new Date(enq.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={enq.status === "new" ? "accent" : "neutral"}>{enq.status}</Badge>
                </div>
              ))}
            </Card>
          )}
        </div>

        {/* 5. Availability */}
        <Card className="p-6">
          <h2 className="text-base font-semibold text-[var(--color-text)]">Availability</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="neutral">{profile.availabilityStatus || "Not set"}</Badge>
            {profile.workMode && <Badge variant="secondary">{profile.workMode}</Badge>}
          </div>
          <div className="mt-4">
            <Button href="/create-profile?step=4" variant="outline" size="sm">Update availability</Button>
          </div>
        </Card>

        {/* 6. Account actions */}
        <Card className="p-6">
          <h2 className="text-base font-semibold text-[var(--color-text)]">Account</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button href="/create-profile?step=5" variant="outline" size="sm">Edit account</Button>
            <Button type="button" variant="outline" size="sm" onClick={togglePublishStatus} disabled={togglingStatus}>
              Privacy: {profile.status === "published" ? "Public" : "Private (draft)"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={handleSignOut}>Sign out</Button>
          </div>
        </Card>
      </Container>
    </div>
  );
}
