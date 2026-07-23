import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    const missing = [
      ["NEXT_PUBLIC_SUPABASE_URL", url],
      ["NEXT_PUBLIC_SUPABASE_ANON_KEY", anonKey],
    ].filter(([, v]) => !v).map(([k]) => k);
    const message = `Missing Supabase env vars: ${missing.join(", ")}. Add them to .env.local and restart dev server.`;
    if (process.env.NODE_ENV !== "production") {
      throw new Error(message);
    } else {
      console.warn(message);
    }
  }

  cached = createClient(url ?? "", anonKey ?? "");
  return cached;
}

export const supabase = getSupabaseClient();

export const ARTIST_MEDIA_BUCKET = "artist-media";

export type ArtistProfile = {
  id: string;
  slug: string;
  fullName: string;
  stageName: string;
  headline: string;
  profilePictureUrl: string;
  coverBannerUrl: string;
  /** Vertical crop offset (0-100) for the cover banner, set by dragging in the profile editor. */
  coverBannerPositionY: number;
  artForm: string;
  artSubForms: string[];
  skills: string[];
  genres: string[];
  instruments: string[];
  groupType: string;
  bio: string;
  state: string;
  city: string;
  country: string;
  area: string;
  travelPreference: string;
  youtubeVideos: string[];
  youtubeVideoCaptions?: string[];
  performanceImageUrls: string[];
  performanceImageCaptions?: string[];
  phone: string;
  email: string;
  website: string;
  preferredContactMethod: string;
  instagram: string;
  facebook: string;
  youtube: string;
  experience: string;
  languages: string[];
  eventTypes: string[];
  priceRange: string;
  pricingUnit: string;
  priceNegotiable: boolean;
  availabilityStatus: string;
  workMode: string;
  bookingTypes: string[];
  travelAvailable: boolean;
  eventDuration: string;
  equipmentInfo: string;
  status: "draft" | "published";
  /** Geocoded from city/locality, never a street address. Not exposed in any UI — only used to compute distance. */
  latitude: number | null;
  longitude: number | null;
  updatedAt: string;
  /** Computed in Postgres from the full private row (schema_v10.sql) — a
   * profile can be published but still not indexable if it doesn't meet
   * the minimum completeness bar. Absent (undefined) on rows fetched from
   * the base `artists` table, which don't include this computed column. */
  isIndexable?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapArtistRow(d: any): ArtistProfile {
  return {
    id: d.id ?? "",
    slug: d.slug ?? "",
    fullName: d.full_name ?? "",
    stageName: d.stage_name ?? "",
    headline: d.headline ?? "",
    profilePictureUrl: d.profile_picture_url ?? "",
    coverBannerUrl: d.cover_banner_url ?? "",
    coverBannerPositionY: typeof d.cover_banner_position_y === "number" ? d.cover_banner_position_y : 50,
    artForm: d.art_form ?? "",
    artSubForms: d.art_sub_forms ?? [],
    skills: d.skills ?? [],
    genres: d.genres ?? [],
    instruments: d.instruments ?? [],
    groupType: d.group_type ?? "",
    bio: d.bio ?? "",
    state: d.state ?? "",
    city: d.city ?? "",
    country: d.country ?? "India",
    area: d.area ?? "",
    travelPreference: d.travel_preference ?? "",
    youtubeVideos: d.youtube_videos ?? [],
    youtubeVideoCaptions: d.youtube_video_captions ?? [],
    performanceImageUrls: d.performance_image_urls ?? [],
    performanceImageCaptions: d.performance_image_captions ?? [],
    phone: d.phone ?? "",
    email: d.email ?? "",
    website: d.website ?? "",
    preferredContactMethod: d.preferred_contact_method ?? "",
    instagram: d.instagram ?? "",
    facebook: d.facebook ?? "",
    youtube: d.youtube ?? "",
    experience: d.experience ?? "",
    languages: d.languages ?? [],
    eventTypes: d.event_types ?? [],
    priceRange: d.price_range ?? "",
    pricingUnit: d.pricing_unit ?? "",
    priceNegotiable: d.price_negotiable ?? false,
    availabilityStatus: d.availability_status ?? "",
    workMode: d.work_mode ?? "",
    bookingTypes: d.booking_types ?? [],
    travelAvailable: d.travel_available ?? false,
    eventDuration: d.event_duration ?? "",
    equipmentInfo: d.equipment_info ?? "",
    status: d.status === "published" ? "published" : "draft",
    latitude: typeof d.latitude === "number" ? d.latitude : null,
    longitude: typeof d.longitude === "number" ? d.longitude : null,
    updatedAt: d.updated_at ?? "",
    isIndexable: typeof d.is_indexable === "boolean" ? d.is_indexable : undefined,
  };
}
