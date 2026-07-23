import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase, mapArtistRow, type ArtistProfile } from "@/lib/supabaseClient";
import { mapClientPreferencesRow, type ClientPreferences } from "@/lib/clientPreferences";
import { calculateArtistMatch, type MatchResult } from "@/lib/artistMatch";
import { haversineDistanceKm, formatDistance, type Coordinates } from "@/lib/distance";
import { geocodeLocation } from "@/lib/geocode";
import Container from "@/components/Container";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Logo from "@/components/Logo";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import SaveArtistButton from "@/components/SaveArtistButton";
import { useChat } from "@/components/ChatContext";
import NotificationBell from "@/components/NotificationBell";

const PAGE_SIZE = 12;

type ArtistEntry = { id: string; data: ArtistProfile; createdAt: string; match: MatchResult | null; distanceKm: number | null };

type SortKey = "best" | "priceLow" | "priceHigh" | "name" | "recent" | "distance";

function uniqueSorted(values: (string | undefined)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v && v.trim().length > 0))).sort();
}

function parsePrice(v: string | undefined): number | null {
  if (!v) return null;
  const n = parseInt(v.replace(/[^\d]/g, ""), 10);
  return Number.isNaN(n) ? null : n;
}

function qToStr(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}
function qToBool(v: string | string[] | undefined): boolean {
  return v === "1" || v === "true";
}

// ── Artist card ──────────────────────────────────────────────────────────────
function ArtistCard({ entry, clientId, personalized }: { entry: ArtistEntry; clientId: string | null; personalized: boolean }) {
  const { id, data, match, distanceKm } = entry;
  const locationParts = [data.city, data.state].filter(Boolean);
  const specializations = [...(data.artSubForms ?? []), ...(data.skills ?? [])].slice(0, 3);

  return (
    <div className="relative bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all overflow-visible">
      <Link href={`/artists/${data.slug || id}`} className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] rounded-t-[var(--radius-lg)]">
        <div className="relative h-28 rounded-t-[var(--radius-lg)] overflow-hidden bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)]">
          {data.coverBannerUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.coverBannerUrl} alt="" className="w-full h-full object-cover" />
          )}
          {data.profilePictureUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.profilePictureUrl} alt={data.fullName} className="absolute bottom-0 left-4 translate-y-1/2 z-10 w-14 h-14 rounded-full border-[3px] border-[var(--color-surface)] object-cover shadow-md" />
          )}
        </div>
      </Link>

      <div className={`px-4 pb-4 ${data.profilePictureUrl ? "pt-10" : "pt-3"}`}>
        {data.artForm && <span className="text-[10px] font-bold text-[var(--color-accent)] uppercase tracking-widest">{data.artForm}</span>}
        <Link href={`/artists/${data.slug || id}`} className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] rounded-sm">
          <h3 className="font-bold text-[var(--color-text)] text-base leading-tight mt-0.5 truncate">{data.fullName || data.stageName || "Artist"}</h3>
        </Link>
        {specializations.length > 0 && <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 truncate">{specializations.join(" · ")}</p>}

        <div className="flex items-center justify-between mt-2 gap-1">
          {locationParts.length ? (
            <span className="text-xs text-[var(--color-text-secondary)] truncate">
              {locationParts.join(", ")}{distanceKm != null && ` · ${formatDistance(distanceKm)}`}
            </span>
          ) : <span />}
          <span className="text-xs font-bold text-[var(--color-text)] flex-shrink-0">{data.priceRange ? `₹${data.priceRange}` : "Contact for Price"}</span>
        </div>

        {data.languages?.length > 0 && <p className="text-xs text-[var(--color-text-secondary)] mt-1 truncate">{data.languages.join(", ")}</p>}
        {data.availabilityStatus && <Badge variant={data.availabilityStatus === "Available now" ? "success" : "neutral"} className="mt-2">{data.availabilityStatus}</Badge>}

        {personalized && match && match.reasons.length > 0 && (
          <div className="mt-3 rounded-[var(--radius-md)] bg-[var(--color-accent-soft)] p-2.5">
            <p className="text-[11px] font-bold text-[var(--color-accent-hover)]">{match.matchLabel}</p>
            <ul className="mt-1 space-y-0.5">
              {match.reasons.slice(0, 2).map((r) => (
                <li key={r} className="text-[11px] text-[var(--color-text-secondary)] truncate">✓ {r}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <SaveArtistButton artistId={id} clientId={clientId} className="!min-h-[36px] !px-3 !text-xs flex-1 justify-center" />
          <Link href={`/artists/${data.slug || id}`} className="flex-1 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-xs font-semibold min-h-[36px] px-3 hover:bg-[var(--color-primary-hover)] transition-colors">
            View Profile
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ArtistsPage() {
  const router = useRouter();
  const { openPanel } = useChat();
  const [artists, setArtists] = useState<ArtistEntry[]>([]);
  const [loadingArtists, setLoadingArtists] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [preferences, setPreferences] = useState<ClientPreferences | null>(null);
  const [prefsChecked, setPrefsChecked] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [refPoint, setRefPoint] = useState<Coordinates | null>(null);
  const [locatingMe, setLocatingMe] = useState(false);

  // Auth + preferences
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const uid = session?.user?.id ?? null;
      setClientId(uid);
      if (uid) {
        const { data: clientRow } = await supabase.from("clients").select("id").eq("id", uid).maybeSingle();
        setIsClient(!!clientRow);
        const { data } = await supabase.from("client_preferences").select("*").eq("client_id", uid).maybeSingle();
        const p = data ? mapClientPreferencesRow(data) : null;
        setPreferences(p);
        if (p?.latitude != null && p?.longitude != null) setRefPoint({ lat: p.latitude, lng: p.longitude });
      } else {
        setIsClient(false);
        setPreferences(null);
      }
      setPrefsChecked(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  // "Use my location" — never stored, only used in-session to compute distance.
  function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocatingMe(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setRefPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocatingMe(false); },
      () => setLocatingMe(false),
      { timeout: 10000 }
    );
  }

  // Artists
  useEffect(() => {
    supabase.from("artists_public").select("*").eq("status", "published").then(({ data, error }) => {
      if (error) { setLoadError(error.message); setLoadingArtists(false); return; }
      const entries: ArtistEntry[] = (data ?? []).map((row) => ({ id: row.id, data: mapArtistRow(row), createdAt: row.created_at, match: null, distanceKm: null }));
      setArtists(entries);
      setLoadingArtists(false);
    });
  }, []);

  // Sync search input -> URL (debounced)
  useEffect(() => {
    if (!router.isReady) return;
    setSearchInput(qToStr(router.query.q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  useEffect(() => {
    if (!router.isReady) return;
    const t = setTimeout(() => {
      if (searchInput === qToStr(router.query.q)) return;
      setQuery({ q: searchInput || undefined, page: undefined });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function setQuery(patch: Record<string, string | undefined>) {
    const next = { ...router.query, ...patch };
    Object.keys(next).forEach((k) => { if (next[k] === undefined || next[k] === "") delete next[k]; });
    router.replace({ pathname: "/artists", query: next }, undefined, { shallow: true });
  }

  const q = qToStr(router.query.q).trim().toLowerCase();
  const category = qToStr(router.query.category);
  const specialization = qToStr(router.query.specialization);
  const eventType = qToStr(router.query.eventType);
  const stateFilter = qToStr(router.query.state);
  const cityFilter = qToStr(router.query.city);
  const language = qToStr(router.query.language);
  const maxPrice = qToStr(router.query.maxPrice);
  const availability = qToStr(router.query.availability);
  const mode = qToStr(router.query.mode);
  const travelOnly = qToBool(router.query.travel);
  const groupType = qToStr(router.query.group);
  const portfolioOnly = qToBool(router.query.portfolio);
  const sort = (qToStr(router.query.sort) || (preferences ? "best" : "name")) as SortKey;

  // If the visitor picks a city filter and we don't already have a reference
  // point (from saved preferences or "Use my location"), geocode that city
  // so distance sort/labels work for logged-out browsing too.
  useEffect(() => {
    if (refPoint || !cityFilter) return;
    const query = [cityFilter, stateFilter, "India"].filter(Boolean).join(", ");
    geocodeLocation(query).then((coords) => { if (coords) setRefPoint(coords); });
  }, [cityFilter, stateFilter, refPoint]);

  // Attach match scores + distance
  const withMatch = useMemo(() => {
    return artists.map((e) => ({
      ...e,
      match: preferences ? calculateArtistMatch(e.data, preferences) : null,
      distanceKm: refPoint && e.data.latitude != null && e.data.longitude != null
        ? haversineDistanceKm(refPoint, { lat: e.data.latitude, lng: e.data.longitude })
        : null,
    }));
  }, [artists, preferences, refPoint]);

  // Dynamically derive filter option lists from actual data — never show
  // an option nothing in the dataset actually has.
  const options = useMemo(() => {
    const d = artists.map((e) => e.data);
    return {
      categories: uniqueSorted(d.map((a) => a.artForm)),
      specializations: uniqueSorted(d.flatMap((a) => [...(a.artSubForms ?? []), ...(a.skills ?? [])])),
      eventTypes: uniqueSorted(d.flatMap((a) => a.eventTypes ?? [])),
      states: uniqueSorted(d.map((a) => a.state)),
      cities: uniqueSorted(d.filter((a) => !stateFilter || a.state === stateFilter).map((a) => a.city)),
      languages: uniqueSorted(d.flatMap((a) => a.languages ?? [])),
      availabilities: uniqueSorted(d.map((a) => a.availabilityStatus)),
      modes: uniqueSorted(d.map((a) => a.workMode)),
      hasTravelData: d.some((a) => a.travelAvailable),
      hasGroupData: d.some((a) => a.groupType),
      hasPortfolioData: d.some((a) => (a.performanceImageUrls?.length ?? 0) > 0),
    };
  }, [artists, stateFilter]);

  const tokens = q.split(/\s+/).filter(Boolean);
  function textScore(data: ArtistProfile): number {
    if (!tokens.length) return 1;
    let score = 0;
    for (const t of tokens) {
      if (data.fullName?.toLowerCase().includes(t)) score += 6;
      if (data.stageName?.toLowerCase().includes(t)) score += 6;
      if (data.artForm?.toLowerCase().includes(t)) score += 5;
      for (const s of [...(data.artSubForms ?? []), ...(data.skills ?? [])]) if (s.toLowerCase().includes(t)) score += 4;
      for (const g of data.genres ?? []) if (g.toLowerCase().includes(t)) score += 3;
      for (const l of data.languages ?? []) if (l.toLowerCase().includes(t)) score += 3;
      if (data.city?.toLowerCase().includes(t)) score += 3;
      if (data.state?.toLowerCase().includes(t)) score += 2;
      for (const e of data.eventTypes ?? []) if (e.toLowerCase().includes(t)) score += 2;
    }
    return score;
  }

  const filtered = withMatch.filter((e) => {
    const d = e.data;
    if (tokens.length && textScore(d) === 0) return false;
    if (category && d.artForm !== category) return false;
    if (specialization && ![...(d.artSubForms ?? []), ...(d.skills ?? [])].includes(specialization)) return false;
    if (eventType && !(d.eventTypes ?? []).includes(eventType)) return false;
    if (stateFilter && d.state !== stateFilter) return false;
    if (cityFilter && d.city !== cityFilter) return false;
    if (language && !(d.languages ?? []).includes(language)) return false;
    if (maxPrice) {
      const p = parsePrice(d.priceRange);
      if (p === null || p > parseInt(maxPrice, 10)) return false;
    }
    if (availability && d.availabilityStatus !== availability) return false;
    if (mode && d.workMode !== mode) return false;
    if (travelOnly && !d.travelAvailable) return false;
    if (groupType && d.groupType !== groupType) return false;
    if (portfolioOnly && (d.performanceImageUrls?.length ?? 0) === 0) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "priceLow": {
        const pa = parsePrice(a.data.priceRange) ?? Infinity;
        const pb = parsePrice(b.data.priceRange) ?? Infinity;
        return pa - pb;
      }
      case "priceHigh": {
        const pa = parsePrice(a.data.priceRange) ?? -Infinity;
        const pb = parsePrice(b.data.priceRange) ?? -Infinity;
        return pb - pa;
      }
      case "name":
        return (a.data.fullName || a.data.stageName).localeCompare(b.data.fullName || b.data.stageName);
      case "recent":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "distance": {
        const da = a.distanceKm ?? Infinity;
        const db = b.distanceKm ?? Infinity;
        return da - db;
      }
      case "best":
      default: {
        const sa = a.match?.totalScore ?? textScore(a.data);
        const sb = b.match?.totalScore ?? textScore(b.data);
        return sb - sa;
      }
    }
  });

  const visible = sorted.slice(0, visibleCount);
  const personalized = !!preferences;
  const hasFilters = !!(q || category || specialization || eventType || stateFilter || cityFilter || language || maxPrice || availability || mode || travelOnly || groupType || portfolioOnly);

  function clearFilters() {
    setSearchInput("");
    router.replace({ pathname: "/artists" }, undefined, { shallow: true });
  }

  const activeChips: { key: string; label: string }[] = [
    q && { key: "q", label: `"${q}"` },
    category && { key: "category", label: category },
    specialization && { key: "specialization", label: specialization },
    eventType && { key: "eventType", label: eventType },
    stateFilter && { key: "state", label: stateFilter },
    cityFilter && { key: "city", label: cityFilter },
    language && { key: "language", label: language },
    maxPrice && { key: "maxPrice", label: `Under ₹${maxPrice}` },
    availability && { key: "availability", label: availability },
    mode && { key: "mode", label: mode },
    travelOnly && { key: "travel", label: "Travelling artists" },
    groupType && { key: "group", label: groupType },
    portfolioOnly && { key: "portfolio", label: "Has portfolio" },
  ].filter(Boolean) as { key: string; label: string }[];

  function FiltersPanel() {
    return (
      <div className="space-y-5">
        {options.categories.length > 0 && (
          <FilterSelect label="Artist category" value={category} onChange={(v) => setQuery({ category: v })} options={options.categories} />
        )}
        {options.specializations.length > 0 && (
          <FilterSelect label="Specialization" value={specialization} onChange={(v) => setQuery({ specialization: v })} options={options.specializations} />
        )}
        {options.eventTypes.length > 0 && (
          <FilterSelect label="Event type" value={eventType} onChange={(v) => setQuery({ eventType: v })} options={options.eventTypes} />
        )}
        {options.states.length > 0 && (
          <FilterSelect label="State" value={stateFilter} onChange={(v) => setQuery({ state: v, city: undefined })} options={options.states} />
        )}
        {options.cities.length > 0 && (
          <FilterSelect label="City" value={cityFilter} onChange={(v) => setQuery({ city: v })} options={options.cities} />
        )}
        {options.languages.length > 0 && (
          <FilterSelect label="Language" value={language} onChange={(v) => setQuery({ language: v })} options={options.languages} />
        )}
        <FilterSelect label="Max price" value={maxPrice} onChange={(v) => setQuery({ maxPrice: v })} options={["5000", "15000", "30000", "50000"]} formatLabel={(v) => `Under ₹${v}`} />
        {options.availabilities.length > 0 && (
          <FilterSelect label="Availability" value={availability} onChange={(v) => setQuery({ availability: v })} options={options.availabilities} />
        )}
        {options.modes.length > 0 && (
          <FilterSelect label="Online / offline" value={mode} onChange={(v) => setQuery({ mode: v })} options={options.modes} />
        )}
        {options.hasTravelData && (
          <label className="flex items-center gap-2.5 text-sm text-[var(--color-text)]">
            <input type="checkbox" checked={travelOnly} onChange={(e) => setQuery({ travel: e.target.checked ? "1" : undefined })} className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)]" />
            Open to travel
          </label>
        )}
        {options.hasGroupData && (
          <FilterSelect label="Solo or group" value={groupType} onChange={(v) => setQuery({ group: v })} options={["Solo", "Group"]} />
        )}
        {options.hasPortfolioData && (
          <label className="flex items-center gap-2.5 text-sm text-[var(--color-text)]">
            <input type="checkbox" checked={portfolioOnly} onChange={(e) => setQuery({ portfolio: e.target.checked ? "1" : undefined })} className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)]" />
            Has portfolio
          </label>
        )}
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="text-sm font-semibold text-[var(--color-accent)]">Clear all filters</button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-page)]">
      <div className="sticky top-0 z-40 bg-[var(--color-surface)]/95 backdrop-blur border-b border-[var(--color-border)]">
        <Container className="flex items-center gap-3 h-14">
          <Logo size="sm" />
          <div className="flex-1">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search artists, skills, genres, languages, or locations"
              className="w-full h-9 px-4 bg-[var(--color-primary-soft)] rounded-[var(--radius-md)] text-sm text-[var(--color-text)] placeholder-[var(--color-text-secondary)] border-0 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>
          {clientId ? (
            <>
              {isClient && (
                <>
                  <NotificationBell />
                  <Link href="/my-jobs" className="hidden sm:inline-block flex-shrink-0 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">My Jobs</Link>
                  <Link href="/post-job" className="flex-shrink-0 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">Post a Job</Link>
                </>
              )}
              <button type="button" onClick={openPanel} className="flex-shrink-0 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">Messages</button>
              <Link href="/saved-artists" className="hidden sm:inline-block flex-shrink-0 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">Saved</Link>
              <button onClick={() => supabase.auth.signOut().then(() => router.replace("/"))} className="flex-shrink-0 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">Sign out</button>
            </>
          ) : (
            <Link href={{ pathname: "/signup", query: { role: "client" } }} className="flex-shrink-0 text-xs font-semibold px-4 py-2 bg-[var(--color-primary)] text-white rounded-[var(--radius-md)] hover:bg-[var(--color-primary-hover)] whitespace-nowrap">
              Sign in
            </Link>
          )}
        </Container>
      </div>

      <Container className="py-8">
        <h1 className="text-3xl">{personalized ? "Artists recommended for you" : "Discover artists"}</h1>
        {personalized && (
          <p className="mt-2 text-sm text-[var(--color-text-secondary)] inline-flex items-center gap-1.5">
            Personalised using your saved preferences
            <span className="group relative inline-block">
              <svg className="w-4 h-4 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden w-64 rounded-[var(--radius-md)] bg-[var(--color-primary)] p-3 text-xs text-white group-hover:block z-10">
                This recommendation is based on your artist type, event, location, budget, language, and other selected preferences.
              </span>
            </span>
          </p>
        )}
        {prefsChecked && clientId && !preferences && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--color-accent-soft)] px-4 py-3">
            <p className="text-sm text-[var(--color-accent-hover)] font-medium">Get better recommendations by telling us what you&rsquo;re looking for.</p>
            <Button href="/client-preferences" variant="primary" size="sm">Set preferences</Button>
          </div>
        )}

        <div className="mt-6 grid lg:grid-cols-[240px_1fr] gap-8">
          {/* Desktop filter sidebar */}
          <aside className="hidden lg:block">
            <FiltersPanel />
          </aside>

          <div>
            {/* Mobile filter button + chips */}
            <div className="flex items-center gap-2 mb-4 lg:hidden">
              <button type="button" onClick={() => setFiltersOpen(true)} className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm font-semibold min-h-[40px]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m9 12h3.75M10.5 18a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 18H7.5m9-6h3.75M13.5 12a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 12H10.5" /></svg>
                Filters
              </button>
              <div className="flex gap-2 overflow-x-auto">
                {activeChips.map((c) => (
                  <span key={c.key} className="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-soft)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary)]">
                    {c.label}
                    <button onClick={() => setQuery({ [c.key]: undefined })} aria-label={`Remove ${c.label}`}>×</button>
                  </span>
                ))}
              </div>
            </div>

            {/* Desktop active chips + sort + count */}
            <div className="hidden lg:flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                {activeChips.map((c) => (
                  <span key={c.key} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-soft)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary)]">
                    {c.label}
                    <button onClick={() => setQuery({ [c.key]: undefined })} aria-label={`Remove ${c.label}`}>×</button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <p className="text-sm text-[var(--color-text-secondary)]">{loadingArtists ? "Loading…" : `${sorted.length} artist${sorted.length !== 1 ? "s" : ""}`}</p>
                <button type="button" onClick={useMyLocation} disabled={locatingMe} className="text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] whitespace-nowrap">
                  {locatingMe ? "Locating…" : "Use my location"}
                </button>
                <select value={sort} onChange={(e) => setQuery({ sort: e.target.value })} className="h-9 px-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-sm">
                  {personalized && <option value="best">Best Match</option>}
                  {refPoint && <option value="distance">Nearest First</option>}
                  <option value="priceLow">Price: Low to High</option>
                  <option value="priceHigh">Price: High to Low</option>
                  <option value="name">Name</option>
                  <option value="recent">Recently Added</option>
                </select>
              </div>
            </div>
            <p className="lg:hidden text-sm text-[var(--color-text-secondary)] mb-4">{loadingArtists ? "Loading…" : `${sorted.length} artist${sorted.length !== 1 ? "s" : ""} found`}</p>

            {/* Results */}
            {loadError ? (
              <EmptyState title="Couldn't load artists" description={loadError} />
            ) : loadingArtists ? (
              <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
            ) : sorted.length === 0 ? (
              <EmptyState
                title="No exact matches yet"
                description="Try adjusting your location, budget, date, or artist preferences."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button type="button" variant="primary" size="sm" onClick={clearFilters}>Clear filters</Button>
                    {cityFilter && <Button type="button" variant="outline" size="sm" onClick={() => setQuery({ city: undefined })}>Expand location</Button>}
                    {options.hasTravelData && !travelOnly && <Button type="button" variant="outline" size="sm" onClick={() => setQuery({ travel: "1" })}>Include travelling artists</Button>}
                    {maxPrice && <Button type="button" variant="outline" size="sm" onClick={() => setQuery({ maxPrice: undefined })}>Remove budget restriction</Button>}
                  </div>
                }
              />
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {visible.map((e) => <ArtistCard key={e.id} entry={e} clientId={clientId} personalized={personalized} />)}
                </div>
                {visibleCount < sorted.length && (
                  <div className="mt-8 text-center">
                    <Button type="button" variant="outline" size="md" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                      Load more
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Container>

      {/* Mobile filter drawer */}
      {filtersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setFiltersOpen(false)} />
          <div className="absolute bottom-0 inset-x-0 max-h-[85vh] overflow-y-auto rounded-t-[var(--radius-lg)] bg-[var(--color-surface)] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Filters</h2>
              <button onClick={() => setFiltersOpen(false)} aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <FiltersPanel />
            <Button type="button" variant="primary" size="md" fullWidth className="mt-6" onClick={() => setFiltersOpen(false)}>Show results</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, formatLabel }: { label: string; value: string; onChange: (v: string | undefined) => void; options: string[]; formatLabel?: (v: string) => string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value || undefined)} className="w-full h-10 px-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-sm">
        <option value="">Any</option>
        {options.map((o) => <option key={o} value={o}>{formatLabel ? formatLabel(o) : o}</option>)}
      </select>
    </div>
  );
}
