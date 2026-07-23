import type { ArtistProfile } from "./supabaseClient";
import { SITE_NAME } from "./siteConfig";

/** Minimum published-artist count for a category/city landing page to be
 * indexable — below this it stays reachable but noindex, to avoid thin
 * content pages. Shared between the listing page and the sitemap generator
 * so they never disagree about what's indexable. */
export const LISTING_INDEX_THRESHOLD = 3;

/**
 * Unique, per-profile title/description — never a single generic string
 * reused across every artist. Degrades gracefully when a field is missing
 * rather than ever inventing information that isn't on the profile.
 */
export function buildArtistTitle(profile: Pick<ArtistProfile, "fullName" | "stageName" | "artForm" | "area" | "city">): string {
  const name = profile.stageName || profile.fullName || "Artist";
  const category = profile.artForm;
  const place = profile.area && profile.city ? `${profile.area}, ${profile.city}` : profile.city;

  if (category && place) return `${name} — ${category} in ${place} | ${SITE_NAME}`;
  if (category) return `${name} — ${category} | ${SITE_NAME}`;
  if (place) return `${name} — Artist in ${place} | ${SITE_NAME}`;
  return `${name} | ${SITE_NAME}`;
}

export function buildArtistDescription(profile: Pick<ArtistProfile, "fullName" | "stageName">): string {
  const name = profile.stageName || profile.fullName || "This artist";
  return `Explore ${name}'s portfolio, languages, event experience, pricing and availability. Send a private enquiry through ${SITE_NAME}.`;
}

/** Unique title/description for a category and/or city discovery landing page. */
export function buildListingTitle(category: string | null, city: string | null): string {
  if (category && city) return `${category}s in ${city} | ${SITE_NAME}`;
  if (category) return `${category}s | ${SITE_NAME}`;
  if (city) return `Artists in ${city} | ${SITE_NAME}`;
  return `Discover Artists | ${SITE_NAME}`;
}

export function buildListingDescription(category: string | null, city: string | null, count: number): string {
  const who = category ? `${category.toLowerCase()}s` : "artists";
  const where = city ? ` in ${city}` : "";
  return `Browse ${count} ${who}${where} on ${SITE_NAME}. Compare portfolios, languages, pricing and availability, then send a private enquiry.`;
}
