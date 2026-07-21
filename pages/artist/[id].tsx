import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase, mapArtistRow, type ArtistProfile } from "@/lib/supabaseClient";
import Container from "@/components/Container";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import Logo from "@/components/Logo";
import LoadingSpinner from "@/components/LoadingSpinner";
import SaveArtistButton from "@/components/SaveArtistButton";
import EnquiryModal from "@/components/EnquiryModal";
import { useToast } from "@/components/Toast";

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

// ── Photo gallery (grid, click to view large) ───────────────────────────────
function PhotoGallery({ urls, captions }: { urls: string[]; captions?: string[] }) {
  const [active, setActive] = useState<number | null>(null);
  if (!urls.length) return null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {urls.map((url, i) => (
          <button key={url} type="button" onClick={() => setActive(i)}
            className="relative aspect-square rounded-[var(--radius-md)] overflow-hidden bg-[var(--color-primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={captions?.[i] || ""} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
          </button>
        ))}
      </div>
      {active !== null && (
        <div className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4" onClick={() => setActive(null)}>
          <button type="button" onClick={() => setActive(null)} aria-label="Close" className="absolute top-4 right-4 text-white/80 hover:text-white">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urls[active]} alt={captions?.[active] || ""} className="max-h-[85vh] max-w-full rounded-[var(--radius-md)] object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}

// ── Video list ───────────────────────────────────────────────────────────────
function VideoList({ urls, captions }: { urls: string[]; captions?: string[] }) {
  const entries = urls.map((u, i) => ({ url: u, caption: captions?.[i] ?? "", vid: getYouTubeId(u) })).filter((e) => e.vid);
  if (!entries.length) return null;

  return (
    <div className="grid sm:grid-cols-2 gap-5">
      {entries.map((e) => (
        <div key={e.url}>
          <div className="relative rounded-[var(--radius-lg)] overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
            <iframe src={`https://www.youtube.com/embed/${e.vid}?rel=0`} title="Performance video" allowFullScreen className="w-full h-full border-0" loading="lazy" />
          </div>
          {e.caption && <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{e.caption}</p>}
        </div>
      ))}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold text-[var(--color-text)] mb-4">{children}</h2>;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function PublicArtistPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<ArtistProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [enquiryOpen, setEnquiryOpen] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      setAuthChecked(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const id = router.query.id as string;
    if (!id) { router.replace("/artists"); return; }

    (async () => {
      try {
        const { data: d, error: dbError } = await supabase.from("artists").select("*").eq("id", id).maybeSingle();
        if (dbError) throw dbError;
        if (d) setProfile(mapArtistRow(d));
        else setError("Artist not found.");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [router.isReady, router.query.id, router]);

  function handleContactClick() {
    if (!userId) {
      router.push({ pathname: "/signup", query: { role: "client", returnTo: router.asPath } });
      return;
    }
    setEnquiryOpen(true);
  }

  async function handleShare() {
    const url = window.location.href;
    const title = `${profile?.fullName || "Artist"} on ArtiSync`;
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      showToast("Link copied to clipboard", "success");
    }
  }

  if (loading || !authChecked) {
    return (
      <div className="min-h-screen bg-[var(--color-page)] flex items-center justify-center">
        <LoadingSpinner size="lg" label="Loading profile" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[var(--color-page)] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-[var(--color-text-secondary)] mb-6">{error ?? "Artist not found."}</p>
          <Button href="/artists" variant="primary" size="md">Browse Artists</Button>
        </div>
      </div>
    );
  }

  const videos = profile.youtubeVideos?.filter(Boolean) ?? [];
  const images = profile.performanceImageUrls ?? [];
  const locationLine = [profile.area, profile.city, profile.state].filter(Boolean).join(", ");
  const specializations = [...(profile.artSubForms ?? []), ...(profile.skills ?? [])];
  const displayName = profile.fullName || profile.stageName || "Artist";

  return (
    <div className="min-h-screen bg-[var(--color-page)] pb-24 lg:pb-0">
      {userId && (
        <EnquiryModal open={enquiryOpen} onClose={() => setEnquiryOpen(false)} artistId={router.query.id as string} clientId={userId} />
      )}

      {/* ── Navbar ── */}
      <div className="sticky top-0 z-40 flex items-center justify-between px-5 h-14 bg-[var(--color-primary)]/90 backdrop-blur-md">
        <Link href="/artists" className="flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          All Artists
        </Link>
        <Logo href={null} variant="light" size="sm" iconOnly className="absolute left-1/2 -translate-x-1/2" />
        {userId ? (
          <button onClick={() => supabase.auth.signOut()} className="text-xs font-semibold text-white/70 hover:text-white transition-colors">Sign out</button>
        ) : (
          <Link href={{ pathname: "/signup", query: { role: "client" } }} className="text-xs font-semibold px-4 py-2 bg-[var(--color-accent)] text-white rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] transition-all">
            Sign in
          </Link>
        )}
      </div>

      {/* ── Cover + identity ── */}
      <div className="relative">
        <div className="h-52 sm:h-72 w-full overflow-hidden bg-gradient-to-br from-[var(--color-primary)] via-[var(--color-secondary)] to-[var(--color-primary)]">
          {profile.coverBannerUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.coverBannerUrl} alt="" className="w-full h-full object-cover object-center" />
          )}
        </div>
        {profile.profilePictureUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.profilePictureUrl} alt={displayName}
            className="absolute bottom-0 left-5 sm:left-10 translate-y-1/2 z-10 w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover border-4 border-[var(--color-page)] shadow-xl" />
        )}
      </div>

      <Container className={`${profile.profilePictureUrl ? "pt-20 sm:pt-24" : "pt-8"} pb-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {profile.artForm && <Badge variant="accent" className="mb-3">{profile.artForm}</Badge>}
            <h1 className="text-3xl sm:text-4xl">{displayName}</h1>
            {profile.stageName && profile.fullName && profile.stageName !== profile.fullName && (
              <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">Also known as {profile.stageName}</p>
            )}
            {profile.headline && <p className="mt-2 text-base text-[var(--color-text-secondary)]">{profile.headline}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[var(--color-text-secondary)]">
              {locationLine && (
                <span className="inline-flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  {locationLine}
                </span>
              )}
              {profile.languages?.length > 0 && <span>{profile.languages.join(", ")}</span>}
              {profile.availabilityStatus && <Badge variant={profile.availabilityStatus === "Available now" ? "success" : "neutral"}>{profile.availabilityStatus}</Badge>}
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <button type="button" onClick={handleShare} className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold hover:border-[var(--color-accent)] min-h-[44px]
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" /></svg>
              Share
            </button>
            <SaveArtistButton artistId={router.query.id as string} clientId={userId} />
            <Button type="button" variant="primary" size="md" onClick={handleContactClick}>Contact Artist</Button>
          </div>
        </div>
      </Container>

      {/* ── Two-column body ── */}
      <Container className="grid lg:grid-cols-3 gap-10 pb-16">
        <div className="lg:col-span-2 space-y-10">
          {profile.bio && (
            <section>
              <SectionHeading>About</SectionHeading>
              <p className="text-[var(--color-text)] leading-relaxed whitespace-pre-line">{profile.bio}</p>
            </section>
          )}

          {specializations.length > 0 && (
            <section>
              <SectionHeading>Skills and specializations</SectionHeading>
              <div className="flex flex-wrap gap-2">
                {specializations.map((s) => <Badge key={s} variant="secondary" className="normal-case tracking-normal">{s}</Badge>)}
              </div>
            </section>
          )}

          {images.length > 0 && (
            <section>
              <SectionHeading>Portfolio</SectionHeading>
              <PhotoGallery urls={images} captions={profile.performanceImageCaptions} />
            </section>
          )}

          {videos.length > 0 && (
            <section>
              <SectionHeading>Performance videos</SectionHeading>
              <VideoList urls={videos} captions={profile.youtubeVideoCaptions} />
            </section>
          )}

          {profile.eventTypes?.length > 0 && (
            <section>
              <SectionHeading>Event types</SectionHeading>
              <div className="flex flex-wrap gap-2">
                {profile.eventTypes.map((e) => <Badge key={e} variant="accent" className="normal-case tracking-normal">{e}</Badge>)}
              </div>
            </section>
          )}

          {(profile.travelPreference || profile.travelAvailable) && (
            <section>
              <SectionHeading>Location and travel</SectionHeading>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {locationLine && <>Based in {locationLine}. </>}
                {profile.travelPreference && <>Willing to travel: {profile.travelPreference}.</>}
              </p>
            </section>
          )}
        </div>

        {/* ── Sticky sidebar (desktop) ── */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-4">
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
              <p className="text-2xl font-bold text-[var(--color-text)]">
                {profile.priceRange ? `₹${profile.priceRange}` : "Contact for price"}
              </p>
              {profile.pricingUnit && <p className="text-sm text-[var(--color-text-secondary)]">{profile.pricingUnit}{profile.priceNegotiable ? " · Negotiable" : ""}</p>}
              <Button type="button" variant="primary" size="lg" fullWidth className="mt-5" onClick={handleContactClick}>
                Contact Artist
              </Button>
              <div className="mt-3">
                <SaveArtistButton artistId={router.query.id as string} clientId={userId} className="w-full justify-center" />
              </div>

              <dl className="mt-6 space-y-3 text-sm border-t border-[var(--color-border)] pt-5">
                {profile.experience && (
                  <div className="flex justify-between"><dt className="text-[var(--color-text-secondary)]">Experience</dt><dd className="font-medium text-[var(--color-text)]">{profile.experience}</dd></div>
                )}
                {profile.workMode && (
                  <div className="flex justify-between"><dt className="text-[var(--color-text-secondary)]">Mode</dt><dd className="font-medium text-[var(--color-text)]">{profile.workMode}</dd></div>
                )}
                {profile.eventDuration && (
                  <div className="flex justify-between"><dt className="text-[var(--color-text-secondary)]">Typical duration</dt><dd className="font-medium text-[var(--color-text)]">{profile.eventDuration}</dd></div>
                )}
              </dl>
            </div>
          </div>
        </aside>
      </Container>

      {/* ── Mobile sticky contact bar ── */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-[var(--color-text)] truncate">{profile.priceRange ? `₹${profile.priceRange}` : "Contact for price"}</p>
        </div>
        <SaveArtistButton artistId={router.query.id as string} clientId={userId} className="!px-3" />
        <Button type="button" variant="primary" size="md" onClick={handleContactClick}>Contact</Button>
      </div>
    </div>
  );
}
