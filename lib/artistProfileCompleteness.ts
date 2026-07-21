import type { ArtistProfile } from "./supabaseClient";

export type CompletenessField = {
  key: string;
  label: string;
  sectionId: string;
  done: boolean;
};

export type CompletenessResult = {
  percentage: number;
  missingFields: string[];
  nextIncompleteSection: string | null;
  publishable: boolean;
};

type CompletenessInput = Partial<
  Pick<
    ArtistProfile,
    "fullName" | "profilePictureUrl" | "artForm" | "artSubForms" | "bio" | "city" | "state" | "performanceImageUrls" | "youtubeVideos" | "phone" | "email"
  >
> | null | undefined;

function nonEmpty(v: string | undefined | null): boolean {
  return !!v && v.trim().length > 0;
}

export function getArtistProfileCompleteness(profile: CompletenessInput): CompletenessResult {
  const p = profile ?? {};

  const fields: CompletenessField[] = [
    { key: "name", label: "Artist or stage name", sectionId: "section-name", done: nonEmpty(p.fullName) },
    { key: "photo", label: "Profile photograph", sectionId: "section-photo", done: nonEmpty(p.profilePictureUrl) },
    { key: "artForm", label: "Primary art form", sectionId: "section-art-form", done: nonEmpty(p.artForm) },
    { key: "skills", label: "At least one skill", sectionId: "section-art-form", done: (p.artSubForms?.length ?? 0) > 0 },
    { key: "bio", label: "Biography", sectionId: "section-bio", done: nonEmpty(p.bio) },
    { key: "location", label: "Location", sectionId: "section-location", done: nonEmpty(p.city) && nonEmpty(p.state) },
    {
      key: "portfolio",
      label: "At least one portfolio item",
      sectionId: "section-portfolio",
      done: (p.performanceImageUrls?.length ?? 0) > 0 || (p.youtubeVideos?.filter(nonEmpty).length ?? 0) > 0,
    },
    { key: "contact", label: "Contact method", sectionId: "section-contact", done: nonEmpty(p.phone) || nonEmpty(p.email) },
  ];

  const doneCount = fields.filter((f) => f.done).length;
  const percentage = Math.round((doneCount / fields.length) * 100);
  const missingFields = fields.filter((f) => !f.done).map((f) => f.label);
  const nextIncompleteSection = fields.find((f) => !f.done)?.sectionId ?? null;

  return {
    percentage,
    missingFields,
    nextIncompleteSection,
    publishable: missingFields.length === 0,
  };
}
