import { supabase } from "./supabaseClient";

export type EntryRole = "artist" | "client";

export async function hasArtistProfile(userId: string): Promise<boolean> {
  const { data } = await supabase.from("artists").select("id").eq("id", userId).maybeSingle();
  return !!data;
}

export async function hasClientPreferences(userId: string): Promise<boolean> {
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
  const [isArtist, isClient] = await Promise.all([hasArtistProfile(userId), hasClientPreferences(userId)]);
  if (isArtist) return "/dashboard";
  if (isClient) return "/artists";
  return intendedRole === "client" ? "/client-onboarding" : "/create-profile";
}
