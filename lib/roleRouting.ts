import { supabase } from "./supabaseClient";

export type EntryRole = "artist" | "client";

export const CLIENT_PREFS_DISMISS_KEY = "artisync_client_prefs_dismissed";

export async function hasArtistProfile(userId: string): Promise<boolean> {
  const { data } = await supabase.from("artists").select("id").eq("id", userId).maybeSingle();
  return !!data;
}

/** Does the client have a basic identity record (name/phone/city)? */
export async function hasClientIdentity(userId: string): Promise<boolean> {
  const { data } = await supabase.from("clients").select("id").eq("id", userId).maybeSingle();
  return !!data;
}

/**
 * Central place that decides where an authenticated user should land.
 * An existing artist/client row takes precedence over the role the user
 * originally picked at signup, since that's the strongest signal of who
 * they actually are on repeat visits.
 */
export async function resolveEntryPath(userId: string, intendedRole: EntryRole): Promise<string> {
  const [isArtist, isClient] = await Promise.all([hasArtistProfile(userId), hasClientIdentity(userId)]);
  if (isArtist) return "/dashboard";
  // Clients go straight to browsing — job-specific details (event type,
  // date, budget, etc.) are now collected on /post-job itself, not as an
  // upfront preference wizard every client used to be routed through.
  // /client-preferences still exists for anyone who wants personalized
  // match scoring, just reachable by choice rather than as a gate.
  if (isClient) return "/artists";
  return intendedRole === "client" ? "/client-onboarding" : "/create-profile";
}
