import type { ArtistProfile } from "./supabaseClient";

/**
 * A short, factual, plain-language summary built only from real profile
 * fields — never invented experience, awards, ratings, or availability
 * claims. Meant to be read by both visitors and search/AI crawlers as a
 * dense, accurate description of who this artist is and what they offer.
 */
export function generateArtistSummary(profile: ArtistProfile): string {
  const name = profile.fullName || profile.stageName || "This artist";
  const sentences: string[] = [];

  // Sentence 1: who they are, languages, location.
  const languagePart = profile.languages.length > 0 ? `${joinNatural(profile.languages)} ` : "";
  const category = profile.artForm ? profile.artForm.toLowerCase() : "artist";
  const location = [profile.area, profile.city, profile.state].filter(Boolean).join(", ");
  const article = indefiniteArticleFor(languagePart || category);
  let s1 = `${name} is ${article} ${languagePart}${category}`;
  if (location) s1 += ` based in ${location}`;
  sentences.push(s1 + ".");

  // Sentence 2: event types they perform at.
  if (profile.eventTypes.length > 0) {
    sentences.push(`Performs at ${joinNatural(profile.eventTypes.map((e) => e.toLowerCase()))}.`);
  }

  // Sentence 3: specializations/skills/genres.
  const styles = [...profile.artSubForms, ...profile.genres].slice(0, 4);
  if (styles.length > 0) {
    sentences.push(`Specializes in ${joinNatural(styles)}.`);
  }

  // Sentence 4: mode + travel + enquiry acceptance.
  const modeParts: string[] = [];
  if (profile.workMode) modeParts.push(profile.workMode.toLowerCase());
  let s4 = "";
  if (modeParts.length > 0) s4 += `Available for ${modeParts.join(", ")} bookings`;
  if (profile.travelAvailable) s4 += (s4 ? " and " : "Is ") + "open to travelling for select events";
  if (s4) sentences.push(s4 + ".");

  return sentences.join(" ");
}

function indefiniteArticleFor(word: string): "a" | "an" {
  return /^[aeiou]/i.test(word.trim()) ? "an" : "a";
}

function joinNatural(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
