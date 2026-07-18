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
  fullName: string;
  profilePictureUrl: string;
  coverBannerUrl: string;
  artForm: string;
  artSubForms: string[];
  bio: string;
  state: string;
  city: string;
  country: string;
  area: string;
  youtubeVideos: string[];
  youtubeVideoCaptions?: string[];
  performanceImageUrls: string[];
  performanceImageCaptions?: string[];
  phone: string;
  email: string;
  instagram: string;
  facebook: string;
  youtube: string;
  experience: string;
  languages: string[];
  eventTypes: string[];
  priceRange: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapArtistRow(d: any): ArtistProfile {
  return {
    fullName: d.full_name ?? "",
    profilePictureUrl: d.profile_picture_url ?? "",
    coverBannerUrl: d.cover_banner_url ?? "",
    artForm: d.art_form ?? "",
    artSubForms: d.art_sub_forms ?? [],
    bio: d.bio ?? "",
    state: d.state ?? "",
    city: d.city ?? "",
    country: d.country ?? "India",
    area: d.area ?? "",
    youtubeVideos: d.youtube_videos ?? [],
    youtubeVideoCaptions: d.youtube_video_captions ?? [],
    performanceImageUrls: d.performance_image_urls ?? [],
    performanceImageCaptions: d.performance_image_captions ?? [],
    phone: d.phone ?? "",
    email: d.email ?? "",
    instagram: d.instagram ?? "",
    facebook: d.facebook ?? "",
    youtube: d.youtube ?? "",
    experience: d.experience ?? "",
    languages: d.languages ?? [],
    eventTypes: d.event_types ?? [],
    priceRange: d.price_range ?? "",
  };
}
