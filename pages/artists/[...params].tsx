import { useEffect, useState } from "react";
import type { GetStaticPaths, GetStaticProps } from "next";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { supabase, mapArtistRow, type ArtistProfile } from "@/lib/supabaseClient";
import { ARTIST_CATEGORIES, ALL_CITIES, CATEGORY_ALIASES, pluralizeCategory } from "@/lib/sharedConfig";
import { slugify, buildSlugLookup } from "@/lib/slugify";
import Container from "@/components/Container";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import Logo from "@/components/Logo";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import SaveArtistButton from "@/components/SaveArtistButton";
import { useChat } from "@/components/ChatContext";
import DashboardLink from "@/components/DashboardLink";
import { useToast } from "@/components/Toast";
import { generateArtistSummary } from "@/lib/artistSummary";
import { buildArtistTitle, buildArtistDescription, buildListingTitle, buildListingDescription, LISTING_INDEX_THRESHOLD } from "@/lib/seoMeta";
import { SITE_URL, SITE_NAME } from "@/lib/siteConfig";
import { getYouTubeId } from "@/lib/youtube";
import { buildArtistJsonLd, serializeJsonLd } from "@/lib/structuredData";

const LISTING_FETCH_LIMIT = 60;
const POPULAR_CITIES = ["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Pune", "Kolkata", "Ahmedabad"];

// ── Photo gallery (grid, click to view large) ───────────────────────────────
function PhotoGallery({ urls, captions, artistName }: { urls: string[]; captions?: string[]; artistName: string }) {
  const [active, setActive] = useState<number | null>(null);
  if (!urls.length) return null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {urls.map((url, i) => (
          <button key={url} type="button" onClick={() => setActive(i)}
            className="relative aspect-square rounded-[var(--radius-md)] overflow-hidden bg-[var(--color-primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={captions?.[i] || `Portfolio photo ${i + 1} of ${artistName}`} loading="lazy" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
          </button>
        ))}
      </div>
      {active !== null && (
        <div className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4" onClick={() => setActive(null)}>
          <button type="button" onClick={() => setActive(null)} aria-label="Close" className="absolute top-4 right-4 text-white/80 hover:text-white">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urls[active]} alt={captions?.[active] || `Portfolio photo ${active + 1} of ${artistName}`} className="max-h-[85vh] max-w-full rounded-[var(--radius-md)] object-contain" onClick={(e) => e.stopPropagation()} />
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

// ── Data ─────────────────────────────────────────────────────────────────────

type ProfilePageProps = { kind: "profile"; profile: ArtistProfile };
type ListingPageProps = {
  kind: "listing";
  category: string | null;
  city: string | null;
  artists: ArtistProfile[];
  totalCount: number;
  indexable: boolean;
};
type PageProps = ProfilePageProps | ListingPageProps;

// Only published profiles/listings are pre-rendered at build time; everything
// else is generated on first request and cached (ISR).
export const getStaticPaths: GetStaticPaths = async () => {
  return { paths: [], fallback: "blocking" };
};

async function buildProfileResult(slug: string): Promise<import("next").GetStaticPropsResult<PageProps>> {
  const { data: published } = await supabase.from("artists_public").select("*").eq("slug", slug).maybeSingle();
  if (published) {
    return { props: { kind: "profile" as const, profile: mapArtistRow(published) }, revalidate: 300 };
  }

  // Slug may have been deliberately changed — permanently redirect to the current one.
  const { data: history } = await supabase.from("artist_slug_history").select("artist_id").eq("slug", slug).maybeSingle();
  if (history) {
    const { data: current } = await supabase.from("artists_public").select("slug").eq("id", history.artist_id).maybeSingle();
    if (current?.slug) {
      return { redirect: { destination: `/artists/${current.slug}`, permanent: true } };
    }
  }

  // Doesn't exist, or exists but isn't published — a real 404, not a fake
  // 200 page. (An artist previewing their own unpublished profile uses the
  // separate, authenticated /profile-preview page, not this public URL.)
  return { notFound: true, revalidate: 60 };
}

async function buildListingResult(category: string | null, city: string | null): Promise<import("next").GetStaticPropsResult<PageProps>> {
  let query = supabase.from("artists_public").select("*", { count: "exact" });
  if (category) query = query.eq("art_form", category);
  if (city) query = query.eq("city", city);

  const { data, count } = await query.order("created_at", { ascending: false }).limit(LISTING_FETCH_LIMIT);
  const artists = (data ?? []).map(mapArtistRow);
  const totalCount = count ?? artists.length;

  return {
    props: {
      kind: "listing" as const,
      category,
      city,
      artists,
      totalCount,
      indexable: totalCount >= LISTING_INDEX_THRESHOLD,
    },
    revalidate: 300,
  };
}

// Resolves a URL segment to a canonical category name, whether it's already
// the canonical slug (e.g. "dancer") or a common alternate wording people
// actually type (e.g. "dance", "dancers", "music" for "Musician").
function resolveCategorySegment(seg: string, categoryLookup: Record<string, string>): string | null {
  return categoryLookup[seg] ?? CATEGORY_ALIASES[seg] ?? null;
}

export const getStaticProps: GetStaticProps<PageProps> = async ({ params }) => {
  const segments = ((params?.params as string[] | undefined) ?? []).map((s) => s.toLowerCase());
  if (segments.length === 0 || segments.length > 2) return { notFound: true };

  const categoryLookup = buildSlugLookup(ARTIST_CATEGORIES);
  const cityLookup = buildSlugLookup(ALL_CITIES);

  if (segments.length === 1) {
    const [seg] = segments;
    const category = resolveCategorySegment(seg, categoryLookup);
    if (category) {
      const canonicalSlug = slugify(category);
      // An alias (e.g. "dance") — redirect permanently to the canonical
      // slug ("dancer") instead of serving duplicate content at both URLs.
      if (canonicalSlug !== seg) return { redirect: { destination: `/artists/${canonicalSlug}`, permanent: true } };
      return buildListingResult(category, null);
    }
    if (cityLookup[seg]) return buildListingResult(null, cityLookup[seg]);
    // Not a known category or city slug — treat as an artist profile slug.
    return buildProfileResult(seg);
  }

  // Two segments: only the category/city combination is a recognized route.
  const [seg1, seg2] = segments;
  const category = resolveCategorySegment(seg1, categoryLookup);
  if (category && cityLookup[seg2]) {
    const canonicalSlug = slugify(category);
    if (canonicalSlug !== seg1) return { redirect: { destination: `/artists/${canonicalSlug}/${seg2}`, permanent: true } };
    return buildListingResult(category, cityLookup[seg2]);
  }
  return { notFound: true };
};

// ── Artist profile view ─────────────────────────────────────────────────────

function ArtistProfileView({ profile }: { profile: ArtistProfile }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { openConversationWithArtist } = useChat();
  const [userId, setUserId] = useState<string | null>(null);
  const [messaging, setMessaging] = useState(false);
  const isOwnProfile = !!userId && userId === profile.id;

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleContactClick() {
    if (!userId) {
      router.push({ pathname: "/signup", query: { role: "client", returnTo: router.asPath } });
      return;
    }
    if (isOwnProfile) return;
    setMessaging(true);
    try {
      await openConversationWithArtist(profile.id);
    } catch {
      showToast("Could not start the conversation. Please try again.", "error");
    } finally {
      setMessaging(false);
    }
  }

  async function handleShare() {
    const url = window.location.href;
    const title = `${profile.fullName || "Artist"} on ArtiSync`;
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      showToast("Link copied to clipboard", "success");
    }
  }

  const videos = profile.youtubeVideos?.filter(Boolean) ?? [];
  const images = profile.performanceImageUrls ?? [];
  const locationLine = [profile.area, profile.city, profile.state].filter(Boolean).join(", ");
  const specializations = [...(profile.artSubForms ?? []), ...(profile.skills ?? [])];
  const displayName = profile.fullName || profile.stageName || "Artist";
  const summary = generateArtistSummary(profile);
  const lastUpdated = profile.updatedAt
    ? new Date(profile.updatedAt).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })
    : null;

  const pageTitle = buildArtistTitle(profile);
  const pageDescription = buildArtistDescription(profile);
  const canonicalUrl = `${SITE_URL}/artists/${profile.slug}`;
  const jsonLd = serializeJsonLd(buildArtistJsonLd(profile));

  return (
    <div className="min-h-screen bg-[var(--color-page)] pb-24 lg:pb-0">
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={canonicalUrl} />
        {profile.isIndexable === false && <meta name="robots" content="noindex, follow" />}
        <meta property="og:type" content="profile" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:locale" content="en_IN" />
        {profile.profilePictureUrl && <meta property="og:image" content={profile.profilePictureUrl} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        {profile.profilePictureUrl && <meta name="twitter:image" content={profile.profilePictureUrl} />}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      </Head>

      {/* ── Navbar ── */}
      <div className="sticky top-0 z-40 flex items-center justify-between px-5 h-14 bg-[var(--color-primary)]/90 backdrop-blur-md">
        <div className="flex items-center gap-5">
          <Logo href="/" variant="light" size="sm" />
          <Link href="/artists" className="hidden sm:flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            All Artists
          </Link>
        </div>
        {userId ? (
          <div className="flex items-center gap-4">
            <DashboardLink className="!text-white/80 hover:!text-white" />
            <button onClick={() => supabase.auth.signOut()} className="text-xs font-semibold text-white/70 hover:text-white transition-colors">Sign out</button>
          </div>
        ) : (
          <Link href={{ pathname: "/signup", query: { role: "client" } }} className="text-xs font-semibold px-4 py-2 bg-[var(--color-accent)] text-white rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] transition-all">
            Sign in
          </Link>
        )}
      </div>

      {/* ── Breadcrumbs ── */}
      <Container className="pt-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-text-secondary)]">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href="/" className="hover:text-[var(--color-text)]">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/artists" className="hover:text-[var(--color-text)]">Artists</Link></li>
            {profile.artForm && (
              <>
                <li aria-hidden="true">/</li>
                <li><Link href={`/artists/${slugify(profile.artForm)}`} className="hover:text-[var(--color-text)]">{pluralizeCategory(profile.artForm)}</Link></li>
              </>
            )}
            {profile.city && (
              <>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href={profile.artForm ? `/artists/${slugify(profile.artForm)}/${slugify(profile.city)}` : `/artists/${slugify(profile.city)}`} className="hover:text-[var(--color-text)]">
                    {profile.city}
                  </Link>
                </li>
              </>
            )}
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-[var(--color-text)]">{displayName}</li>
          </ol>
        </nav>
      </Container>

      {/* ── Cover + identity ── */}
      <div className="relative mt-2">
        <div className="relative h-52 sm:h-72 w-full overflow-hidden bg-gradient-to-br from-[var(--color-primary)] via-[var(--color-secondary)] to-[var(--color-primary)]">
          {profile.coverBannerUrl && (
            <Image src={profile.coverBannerUrl} alt="" fill priority sizes="100vw" className="object-cover" style={{ objectPosition: `center ${profile.coverBannerPositionY}%` }} />
          )}
        </div>
        {profile.profilePictureUrl && (
          <Image src={profile.profilePictureUrl} alt={displayName} width={160} height={160} priority
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
            {summary && <p className="mt-4 max-w-2xl text-sm text-[var(--color-text-secondary)] leading-relaxed">{summary}</p>}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <button type="button" onClick={handleShare} className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold hover:border-[var(--color-accent)] min-h-[44px]
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" /></svg>
              Share
            </button>
            {!isOwnProfile && (
              <>
                <SaveArtistButton artistId={profile.id} clientId={userId} />
                <Button type="button" variant="primary" size="md" onClick={handleContactClick} disabled={messaging}>Message</Button>
              </>
            )}
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
              <PhotoGallery urls={images} captions={profile.performanceImageCaptions} artistName={displayName} />
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
              {!isOwnProfile && (
                <>
                  <Button type="button" variant="primary" size="lg" fullWidth className="mt-5" onClick={handleContactClick} disabled={messaging}>
                    Message
                  </Button>
                  <div className="mt-3">
                    <SaveArtistButton artistId={profile.id} clientId={userId} className="w-full justify-center" />
                  </div>
                </>
              )}

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
              {lastUpdated && (
                <p className="mt-4 text-xs text-[var(--color-text-secondary)]">Profile last updated {lastUpdated}</p>
              )}
            </div>
          </div>
        </aside>
      </Container>

      {/* ── Mobile sticky contact bar ── */}
      {!isOwnProfile && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-[var(--color-text)] truncate">{profile.priceRange ? `₹${profile.priceRange}` : "Contact for price"}</p>
          </div>
          <SaveArtistButton artistId={profile.id} clientId={userId} className="!px-3" />
          <Button type="button" variant="primary" size="md" onClick={handleContactClick} disabled={messaging}>Message</Button>
        </div>
      )}
    </div>
  );
}

// ── Category / city listing view ────────────────────────────────────────────

function ListingView({ category, city, artists, totalCount, indexable }: ListingPageProps) {
  const [visibleCount, setVisibleCount] = useState(24);
  const title = buildListingTitle(category, city);
  const description = buildListingDescription(category, city, totalCount);
  const categoryPlural = category ? pluralizeCategory(category) : null;
  const h1 = categoryPlural && city ? `${categoryPlural} in ${city}` : categoryPlural ? categoryPlural : `Artists in ${city}`;

  const path = ["/artists", category ? slugify(category) : null, city ? slugify(city) : null].filter(Boolean).join("/");
  const canonicalUrl = `${SITE_URL}${path}`;

  const otherCategories = ARTIST_CATEGORIES.filter((c) => c !== category).slice(0, 8);

  return (
    <div className="min-h-screen bg-[var(--color-page)]">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />
        {!indexable && <meta name="robots" content="noindex, follow" />}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
      </Head>

      <header className="sticky top-0 z-40 bg-[var(--color-surface)]/95 backdrop-blur border-b border-[var(--color-border)]">
        <Container className="flex h-16 items-center justify-between">
          <Logo size="sm" />
          <Button href="/artists" variant="ghost" size="sm">All filters</Button>
        </Container>
      </header>

      <Container className="py-10 sm:py-14">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-text-secondary)] mb-4">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href="/" className="hover:text-[var(--color-text)]">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/artists" className="hover:text-[var(--color-text)]">Artists</Link></li>
            {category && (
              <>
                <li aria-hidden="true">/</li>
                {city ? (
                  <li><Link href={`/artists/${slugify(category)}`} className="hover:text-[var(--color-text)]">{categoryPlural}</Link></li>
                ) : (
                  <li aria-current="page" className="text-[var(--color-text)]">{categoryPlural}</li>
                )}
              </>
            )}
            {city && (
              <>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="text-[var(--color-text)]">{city}</li>
              </>
            )}
          </ol>
        </nav>

        <h1 className="text-3xl">{h1}</h1>
        <p className="mt-3 max-w-2xl text-[var(--color-text-secondary)]">
          {totalCount > 0
            ? `${totalCount} ${categoryPlural ?? "Artists"}${city ? ` in ${city}` : ""} on ${SITE_NAME}. Browse portfolios, languages, and pricing, then send a private enquiry.`
            : `We don't have any published ${categoryPlural ?? "artists"}${city ? ` in ${city}` : ""} yet. Check back soon, or browse all artists.`}
        </p>

        {artists.length === 0 ? (
          <Card className="mt-8 p-6">
            <EmptyState
              title="No artists found here yet"
              description="Try browsing all artists instead, or check back soon as more artists join."
              action={<Button href="/artists" variant="primary" size="sm">Browse all artists</Button>}
            />
          </Card>
        ) : (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {artists.slice(0, visibleCount).map((artist) => (
                <Card key={artist.id} href={`/artists/${artist.slug || artist.id}`} className="p-4">
                  <div className="flex items-center gap-3">
                    {artist.profilePictureUrl && (
                      <Image src={artist.profilePictureUrl} alt={artist.fullName || artist.stageName} width={48} height={48} loading="lazy" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--color-text)] truncate">{artist.stageName || artist.fullName || "Artist"}</p>
                      <p className="text-xs text-[var(--color-text-secondary)] truncate">{[artist.city, artist.state].filter(Boolean).join(", ")}</p>
                    </div>
                  </div>
                  {artist.headline && <p className="mt-2 text-sm text-[var(--color-text-secondary)] line-clamp-2">{artist.headline}</p>}
                </Card>
              ))}
            </div>
            {visibleCount < artists.length && (
              <div className="mt-8 text-center">
                <Button variant="outline" size="md" onClick={() => setVisibleCount((c) => c + 24)}>Show more</Button>
              </div>
            )}
          </>
        )}

        {category && city && (
          <div className="mt-14 flex flex-wrap gap-6">
            <Link href={`/artists/${slugify(category)}`} className="text-sm text-[var(--color-accent)] hover:underline">
              See all {categoryPlural} (all cities)
            </Link>
            <Link href={`/artists/${slugify(city)}`} className="text-sm text-[var(--color-accent)] hover:underline">
              See all artists in {city}
            </Link>
          </div>
        )}

        {!city && otherCategories.length > 0 && (
          <div className="mt-14">
            <h2 className="text-base font-semibold text-[var(--color-text)] mb-3">Browse other categories</h2>
            <div className="flex flex-wrap gap-2">
              {otherCategories.map((c) => (
                <Link key={c} href={`/artists/${slugify(c)}`} className="text-sm px-3 py-1.5 rounded-full border border-[var(--color-border)] hover:border-[var(--color-accent)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
                  {pluralizeCategory(c)}
                </Link>
              ))}
            </div>
          </div>
        )}

        {category && !city && POPULAR_CITIES.length > 0 && (
          <div className="mt-8">
            <h2 className="text-base font-semibold text-[var(--color-text)] mb-3">Popular locations</h2>
            <div className="flex flex-wrap gap-2">
              {POPULAR_CITIES.map((c) => (
                <Link key={c} href={`/artists/${slugify(category)}/${slugify(c)}`} className="text-sm px-3 py-1.5 rounded-full border border-[var(--color-border)] hover:border-[var(--color-accent)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
                  {categoryPlural} in {c}
                </Link>
              ))}
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ArtistsCatchAllPage(props: PageProps | undefined) {
  const router = useRouter();

  if (router.isFallback || !props) {
    return (
      <div className="min-h-screen bg-[var(--color-page)] flex items-center justify-center px-4">
        <p className="text-[var(--color-text-secondary)]">Loading…</p>
      </div>
    );
  }

  if (props.kind === "profile") return <ArtistProfileView profile={props.profile} />;
  return <ListingView {...props} />;
}
