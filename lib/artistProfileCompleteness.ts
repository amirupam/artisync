import type { ArtistProfile } from "./supabaseClient";

export type CompletenessField = {
  key: string;
  label: string;
  /** Which wizard step (1-5) this field lives on in create-profile.tsx. */
  step: number;
  done: boolean;
};

export type CompletenessResult = {
  percentage: number;
  missingFields: string[];
  /** First incomplete step (1-5), or null if everything required is filled. */
  nextIncompleteSection: number | null;
  publishable: boolean;
};

type CompletenessInput = Partial<
  Pick<
    ArtistProfile,
    "fullName" | "stageName" | "profilePictureUrl" | "artForm" | "artSubForms" | "skills" | "bio" | "city" | "state" | "performanceImageUrls" | "youtubeVideos" | "phone" | "email"
  >
> | null | undefined;

function nonEmpty(v: string | undefined | null): boolean {
  return !!v && v.trim().length > 0;
}

/**
 * Shared source of truth for "is this artist profile complete enough to
 * publish?" — used by the profile wizard (to pick the first incomplete
 * step) and the dashboard (completion bar + missing-fields list).
 */
export function getArtistProfileCompleteness(profile: CompletenessInput): CompletenessResult {
  const p = profile ?? {};

  const fields: CompletenessField[] = [
    { key: "name", label: "Artist or stage name", step: 1, done: nonEmpty(p.fullName) || nonEmpty(p.stageName) },
    { key: "photo", label: "Profile photograph", step: 1, done: nonEmpty(p.profilePictureUrl) },
    { key: "bio", label: "Biography", step: 1, done: nonEmpty(p.bio) },
    { key: "location", label: "Location", step: 1, done: nonEmpty(p.city) && nonEmpty(p.state) },
    { key: "artForm", label: "Primary art form", step: 2, done: nonEmpty(p.artForm) },
    { key: "skills", label: "At least one skill", step: 2, done: (p.artSubForms?.length ?? 0) > 0 || (p.skills?.length ?? 0) > 0 },
    {
      key: "portfolio",
      label: "At least one portfolio item",
      step: 3,
      done: (p.performanceImageUrls?.length ?? 0) > 0 || (p.youtubeVideos?.filter(nonEmpty).length ?? 0) > 0,
    },
    { key: "contact", label: "Contact method", step: 5, done: nonEmpty(p.phone) || nonEmpty(p.email) },
  ];

  const doneCount = fields.filter((f) => f.done).length;
  const percentage = Math.round((doneCount / fields.length) * 100);
  const missingFields = fields.filter((f) => !f.done).map((f) => f.label);
  const nextIncompleteSection = fields.find((f) => !f.done)?.step ?? null;

  return {
    percentage,
    missingFields,
    nextIncompleteSection,
    publishable: missingFields.length === 0,
  };
}
