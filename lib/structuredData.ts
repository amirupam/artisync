import type { ArtistProfile } from "./supabaseClient";
import { SITE_URL } from "./siteConfig";
import { getYouTubeThumbnail } from "./youtube";

const MUSIC_CATEGORIES = ["Musician", "Singer", "DJ"];

/**
 * Builds a schema.org ProfilePage graph for a public artist profile, using
 * only real, visible fields — never fabricated ratings, reviews, awards,
 * or availability. Pass the result through `serializeJsonLd` before
 * injecting it into a <script> tag.
 */
export function buildArtistJsonLd(profile: ArtistProfile) {
  const url = `${SITE_URL}/artists/${profile.slug}`;
  const name = profile.stageName || profile.fullName || "Artist";
  const isGroup = profile.groupType === "Group";
  const entityType = isGroup ? (MUSIC_CATEGORIES.includes(profile.artForm) ? "MusicGroup" : "PerformingGroup") : "Person";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entity: Record<string, any> = {
    "@type": entityType,
    name,
    url,
  };

  if (profile.fullName && profile.stageName && profile.fullName !== profile.stageName) {
    entity.alternateName = profile.fullName;
  }
  if (profile.profilePictureUrl) entity.image = profile.profilePictureUrl;
  if (profile.bio) entity.description = profile.bio;
  if (!isGroup && profile.artForm) entity.jobTitle = profile.artForm;

  if (profile.city || profile.state) {
    entity.homeLocation = {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        ...(profile.area || profile.city ? { addressLocality: profile.area || profile.city } : {}),
        ...(profile.state ? { addressRegion: profile.state } : {}),
        addressCountry: profile.country || "IN",
      },
    };
  }

  if (profile.city) {
    entity.areaServed = profile.travelAvailable && profile.state
      ? { "@type": "AdministrativeArea", name: profile.state }
      : { "@type": "City", name: profile.city };
  }

  if (profile.languages.length > 0) entity.knowsLanguage = profile.languages;

  const knowsAbout = [...profile.artSubForms, ...profile.skills, ...profile.genres];
  if (knowsAbout.length > 0) entity.knowsAbout = knowsAbout;

  const sameAs = [profile.instagram, profile.facebook, profile.youtube, profile.website].filter(Boolean);
  if (sameAs.length > 0) entity.sameAs = sameAs;

  if (profile.updatedAt) entity.dateModified = profile.updatedAt;

  const priceNumeric = profile.priceRange ? profile.priceRange.replace(/[^\d.]/g, "") : "";
  if (priceNumeric) {
    entity.makesOffer = {
      "@type": "Offer",
      priceCurrency: "INR",
      price: priceNumeric,
      ...(profile.availabilityStatus === "Available now" ? { availability: "https://schema.org/InStock" } : {}),
      itemOffered: {
        "@type": "Service",
        name: `${profile.artForm || "Performance"} booking`,
        ...(profile.eventTypes.length > 0 ? { serviceType: profile.eventTypes.join(", ") } : {}),
      },
    };
  }

  const videos = (profile.youtubeVideos || [])
    .filter(Boolean)
    .map((videoUrl, i) => {
      const thumbnail = getYouTubeThumbnail(videoUrl);
      if (!thumbnail) return null;
      return {
        "@type": "VideoObject",
        name: profile.youtubeVideoCaptions?.[i] || `${name} performance video`,
        description: profile.youtubeVideoCaptions?.[i] || `Performance video by ${name}`,
        thumbnailUrl: thumbnail,
        contentUrl: videoUrl,
        ...(profile.updatedAt ? { uploadDate: profile.updatedAt } : {}),
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    ...(profile.updatedAt ? { dateModified: profile.updatedAt } : {}),
    mainEntity: entity,
    ...(videos.length > 0 ? { video: videos } : {}),
  };
}

/** Safely serializes a JSON-LD object for a <script> tag, escaping `<` so
 * user-supplied text (e.g. bio) can never break out of the script context. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
