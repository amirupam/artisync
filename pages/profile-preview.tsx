import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase, mapArtistRow, type ArtistProfile } from "@/lib/supabaseClient";
import Logo from "@/components/Logo";
import NoIndexMeta from "@/components/NoIndexMeta";

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

// ── Marquee photo strip (true circular queue — measures exact px width) ───
function PhotoMarquee({ urls, captions }: { urls: string[]; captions?: string[] }) {
  const firstSetRef = useRef<HTMLDivElement>(null);
  const [marqueeWidth, setMarqueeWidth] = useState(0);

  useEffect(() => {
    const node = firstSetRef.current;
    if (!node) return;
    const measure = () => setMarqueeWidth(node.offsetWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [urls]);

  if (!urls.length) return null;
  const durationS = Math.max(14, urls.length * 3);

  // Render both sets identically; only apply animation once width is known
  const renderSet = (hidden?: boolean) => (
    <div
      ref={hidden ? undefined : firstSetRef}
      className="flex gap-4 pr-4 flex-shrink-0"
      aria-hidden={hidden || undefined}
    >
      {urls.map((url, i) => (
        <div key={i} className="flex-shrink-0">
          <div className="w-72 h-48 rounded-2xl overflow-hidden shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={hidden ? "" : (captions?.[i] || `Photo ${i + 1}`)}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
            />
          </div>
          {captions?.[i] && (
            <p className="w-72 mt-1.5 text-center text-xs text-gray-500 font-medium truncate px-1">{captions[i]}</p>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div
      className="overflow-hidden w-full"
      style={{ WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)" }}
    >
      <div
        className={marqueeWidth > 0 ? "flex animate-marquee" : "flex"}
        style={{
          "--marquee-duration": `${durationS}s`,
          "--marquee-width": `${marqueeWidth}px`,
        } as React.CSSProperties}
      >
        {renderSet()}
        {renderSet(true)}
      </div>
    </div>
  );
}

// ── Auto video carousel ────────────────────────────────────────────────────
function AutoVideoCarousel({ urls, captions }: { urls: string[]; captions?: string[] }) {
  // Keep captions aligned with valid urls only
  const validEntries = urls
    .map((u, i) => ({ url: u, caption: captions?.[i] ?? "" }))
    .filter((e) => !!getYouTubeId(e.url));
  const valid = validEntries.map((e) => e.url);
  const validCaptions = validEntries.map((e) => e.caption);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || valid.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % valid.length), 9000);
    return () => clearInterval(t);
  }, [paused, valid.length]);

  if (!valid.length) return null;
  const vid = getYouTubeId(valid[idx])!;

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {/* Main player */}
      <div className="relative rounded-3xl overflow-hidden bg-black shadow-2xl shadow-black/40" style={{ aspectRatio: "16/9" }}>
        <iframe
          key={vid}
          src={`https://www.youtube.com/embed/${vid}?rel=0&autoplay=0`}
          title="Video"
          allowFullScreen
          className="w-full h-full border-0"
        />
        {valid.length > 1 && (
          <>
            <button
              onClick={() => setIdx((i) => (i - 1 + valid.length) % valid.length)}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-2xl bg-black/70 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/90 hover:scale-105 transition-all shadow-xl"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setIdx((i) => (i + 1) % valid.length)}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-2xl bg-black/70 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/90 hover:scale-105 transition-all shadow-xl"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {/* Counter badge */}
            <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-black/70 backdrop-blur-md rounded-full text-white text-xs font-bold tracking-wide">
              {idx + 1} / {valid.length}
            </div>
          </>
        )}
      </div>

      {/* Active video caption */}
      {validCaptions[idx] && (
        <p className="mt-3 text-sm text-gray-600 text-center italic">{validCaptions[idx]}</p>
      )}

      {/* Thumbnail strip */}
      {valid.length > 1 && (
        <div className="flex items-center gap-3 mt-5">
          {/* Thumbnail strip */}
          <div className="flex gap-2 overflow-x-auto pb-0.5 flex-1">
            {valid.map((u, i) => {
              const tid = getYouTubeId(u)!;
              return (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`flex-shrink-0 relative w-28 sm:w-32 h-16 sm:h-[4.5rem] rounded-xl overflow-hidden transition-all duration-300 ${
                    i === idx
                      ? "ring-2 ring-amber-400 shadow-lg shadow-amber-400/30 scale-105"
                      : "opacity-40 hover:opacity-70 hover:scale-102"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://img.youtube.com/vi/${tid}/mqdefault.jpg`} alt="" className="w-full h-full object-cover" />
                  <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${i === idx ? "opacity-100" : "opacity-80"}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shadow-md ${i === idx ? "bg-red-600" : "bg-black/70"}`}>
                      <svg className="w-3.5 h-3.5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ProfilePreviewPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ArtistProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function handleUser(u: { id: string } | null | undefined) {
      if (cancelled) return;
      if (!u) { router.replace({ pathname: "/signup", query: { role: "artist" } }); return; }
      try {
        const { data: d, error: dbError } = await supabase.from("artists").select("*").eq("id", u.id).maybeSingle();
        if (cancelled) return;
        if (dbError) throw dbError;
        if (d) setProfile(mapArtistRow(d)); else setError("No profile found.");
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => handleUser(session?.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      handleUser(session?.user);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [router]);

  if (loading) return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
      <NoIndexMeta />
      <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error || !profile) return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center px-4">
      <NoIndexMeta />
      <div className="text-center">
        <p className="text-gray-400 mb-6">{error ?? "Profile not found."}</p>
        <button onClick={() => router.push("/create-profile")}
          className="px-6 py-3 bg-amber-400 text-gray-900 rounded-xl text-sm font-bold hover:bg-amber-300 transition-all">
          Create Profile
        </button>
      </div>
    </div>
  );

  const videos = profile.youtubeVideos?.filter(Boolean) ?? [];
  const images = profile.performanceImageUrls ?? [];
  const locationLine = [profile.area, profile.city, profile.state, profile.country].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-[#f7f3ee]">
      <NoIndexMeta />

      {/* ── Navbar ── */}
      <div className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-5 h-14 bg-black/50 backdrop-blur-xl">
        <Logo size="sm" variant="light" />
        <button
          onClick={() => router.push("/create-profile")}
          className="text-xs font-semibold px-4 py-2 bg-amber-400 text-gray-900 rounded-lg hover:bg-amber-300 transition-all"
        >
          Edit Profile
        </button>
      </div>

      {/* ── COVER PHOTO ── same fixed-height style as edit profile ── */}
      <div className="relative">
        <div className="h-52 sm:h-72 lg:h-80 w-full overflow-hidden bg-gradient-to-br from-violet-950 via-indigo-900 to-slate-900">
          {profile.coverBannerUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={profile.coverBannerUrl} alt="Cover" className="w-full h-full object-cover object-center" />
            : (
              <>
                <div className="absolute top-10 left-10 w-64 h-64 bg-violet-500/20 rounded-full blur-3xl" />
                <div className="absolute bottom-10 right-10 w-48 h-48 bg-amber-400/15 rounded-full blur-3xl" />
              </>
            )
          }
        </div>

        {/* Profile pic — anchored to the bottom of the cover, half inside half outside */}
        {profile.profilePictureUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.profilePictureUrl}
            alt={profile.fullName}
            className="absolute bottom-0 left-5 sm:left-10 lg:left-14 translate-y-1/2 z-10 w-36 h-36 sm:w-44 sm:h-44 rounded-full object-cover object-center border-4 border-white shadow-2xl"
          />
        )}
      </div>

      {/* ── IDENTITY — name, art form, sub-forms ── */}
      <div className={`bg-[#f7f3ee] px-5 sm:px-10 lg:px-14 pb-6 ${profile.profilePictureUrl ? "pt-20 sm:pt-24" : "pt-6"}`}>
        {profile.artForm && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-400 text-gray-900 text-xs font-bold rounded-full mb-3 uppercase tracking-widest shadow-sm shadow-amber-400/20">
            {profile.artForm}
          </span>
        )}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 leading-none tracking-tight">
          {profile.fullName || "Artist Name"}
        </h1>
        {profile.artSubForms?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {profile.artSubForms.map((s) => (
              <span key={s} className="px-3 py-1 bg-violet-100 text-violet-700 text-xs font-semibold rounded-full">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── STATS BAND — rate & experience front and centre ── */}
      <div className="bg-gradient-to-r from-violet-950 via-indigo-900 to-violet-950 px-5 sm:px-10 lg:px-14 py-6">
        <div className="flex flex-wrap items-center gap-6 sm:gap-12">
          {profile.experience && (
            <div className="flex-shrink-0">
              <p className="text-3xl sm:text-4xl font-black text-white leading-none">{profile.experience.replace("More than ", "").replace(" years", "").replace("Less than 1 year", "<1")}</p>
              <p className="text-xs text-violet-300 uppercase tracking-widest mt-1 font-medium">Experience</p>
            </div>
          )}

          {profile.experience && profile.priceRange && (
            <div className="w-px h-10 bg-white/15 flex-shrink-0 hidden sm:block" />
          )}

          {profile.priceRange && (
            <div className="flex-shrink-0">
              <p className="text-3xl sm:text-4xl font-black text-amber-400 leading-none">₹{profile.priceRange}</p>
              <p className="text-xs text-violet-300 uppercase tracking-widest mt-1 font-medium">Starting Rate</p>
            </div>
          )}

          {(profile.experience || profile.priceRange) && profile.eventTypes?.length > 0 && (
            <div className="w-px h-10 bg-white/15 flex-shrink-0 hidden sm:block" />
          )}

          {profile.eventTypes?.length > 0 && (
            <div className="flex-shrink-0">
              <p className="text-3xl sm:text-4xl font-black text-white leading-none">{profile.eventTypes.length}</p>
              <p className="text-xs text-violet-300 uppercase tracking-widest mt-1 font-medium">Event Types</p>
            </div>
          )}

          {locationLine && (
            <div className="sm:ml-auto flex items-center gap-2 text-violet-200">
              <svg className="w-4 h-4 text-violet-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm font-medium">{locationLine}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="px-5 sm:px-10 lg:px-14 py-10 space-y-12">

        {/* Bio */}
        {profile.bio && (
          <div className="max-w-3xl">
            <Label>About</Label>
            <p className="text-gray-700 text-lg sm:text-xl leading-relaxed font-light">{profile.bio}</p>
          </div>
        )}

        {/* Expertise chips */}
        {(profile.artSubForms?.length > 0 || profile.eventTypes?.length > 0 || profile.languages?.length > 0) && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {profile.artSubForms?.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <Label>Specialisations</Label>
                <div className="flex flex-wrap gap-2">
                  {profile.artSubForms.map((s) => (
                    <span key={s} className="px-3 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-full shadow-sm shadow-violet-200">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {profile.eventTypes?.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <Label>Performs at</Label>
                <div className="flex flex-wrap gap-2">
                  {profile.eventTypes.map((e) => (
                    <span key={e} className="px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-full shadow-sm shadow-amber-200">{e}</span>
                  ))}
                </div>
              </div>
            )}
            {profile.languages?.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <Label>Languages</Label>
                <div className="flex flex-wrap gap-2">
                  {profile.languages.map((l) => (
                    <span key={l} className="px-3 py-1.5 bg-teal-500 text-white text-xs font-semibold rounded-full shadow-sm shadow-teal-200">{l}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PERFORMANCE PHOTOS — full-width marquee row ── */}
        {images.length > 0 && (
          <div>
            <div className="mb-5">
              <Label>Performance Photos</Label>
            </div>
            <PhotoMarquee urls={images} captions={profile.performanceImageCaptions} />
          </div>
        )}

        {/* ── VIDEOS — full-width carousel row ── */}
        {videos.length > 0 && (
          <div>
            <div className="mb-5">
              <Label>Videos</Label>
            </div>
            <AutoVideoCarousel urls={videos} captions={profile.youtubeVideoCaptions} />
          </div>
        )}

        {/* ── Contact cards ── */}
        {(profile.phone || profile.email || profile.instagram || profile.facebook || profile.youtube) && (
          <div>
            <Label>Connect</Label>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {profile.phone && (
                <a href={`tel:${profile.phone}`}
                  className="flex items-center gap-4 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group">
                  <span className="w-11 h-11 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-200">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Phone</p>
                    <p className="text-sm font-bold text-gray-900 truncate">{profile.phone}</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 ml-auto group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              )}
              {profile.email && (
                <a href={`mailto:${profile.email}`}
                  className="flex items-center gap-4 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group">
                  <span className="w-11 h-11 rounded-xl bg-blue-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-200">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Email</p>
                    <p className="text-sm font-bold text-gray-900 truncate">{profile.email}</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 ml-auto group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              )}
              {profile.instagram && (
                <a href={profile.instagram} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-4 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group">
                  <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-pink-500 via-rose-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-pink-200">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Instagram</p>
                    <p className="text-sm font-bold text-gray-900">View Profile →</p>
                  </div>
                </a>
              )}
              {profile.facebook && (
                <a href={profile.facebook} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-4 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group">
                  <span className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-200">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Facebook</p>
                    <p className="text-sm font-bold text-gray-900">View Profile →</p>
                  </div>
                </a>
              )}
              {profile.youtube && (
                <a href={profile.youtube} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-4 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group">
                  <span className="w-11 h-11 rounded-xl bg-red-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-red-200">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">YouTube</p>
                    <p className="text-sm font-bold text-gray-900">View Channel →</p>
                  </div>
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── BOOK CTA ── */}
        {(profile.phone || profile.email) && (
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-950 via-indigo-900 to-violet-950 px-7 sm:px-12 py-10 sm:py-12">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500/20 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />

            <div className="relative flex flex-col sm:flex-row sm:items-center gap-7">
              <div className="flex-1">
                <span className="inline-block px-3 py-1 bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-bold rounded-full uppercase tracking-widest mb-3">
                  Available to Book
                </span>
                <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">{profile.fullName}</h2>
                {profile.priceRange && (
                  <p className="mt-2 text-violet-300">
                    Starting from <span className="text-amber-400 font-black text-xl">₹{profile.priceRange}</span>
                  </p>
                )}
                {profile.eventTypes?.length > 0 && (
                  <p className="mt-1.5 text-violet-400 text-sm">
                    {profile.eventTypes.slice(0, 4).join("  ·  ")}{profile.eventTypes.length > 4 ? `  · +${profile.eventTypes.length - 4} more` : ""}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                {profile.phone && (
                  <a href={`tel:${profile.phone}`}
                    className="flex items-center gap-2 px-7 py-3.5 bg-amber-400 text-gray-900 rounded-xl font-black text-sm hover:bg-amber-300 transition-all shadow-lg shadow-amber-400/30 hover:shadow-amber-400/50 hover:-translate-y-0.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    Call Now
                  </a>
                )}
                {profile.email && (
                  <a href={`mailto:${profile.email}`}
                    className="flex items-center gap-2 px-7 py-3.5 bg-white/10 border border-white/20 text-white rounded-xl font-bold text-sm hover:bg-white/20 transition-all hover:-translate-y-0.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Email
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="h-10" />
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.15em] mb-4 flex items-center gap-2">
      <span className="w-5 h-0.5 bg-amber-400 rounded-full inline-block" />
      {children}
    </h2>
  );
}
