import { SITE_URL } from "./siteConfig";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapPublicArtistRow(row: any) {
  return {
    name: row.full_name ?? "",
    stageName: row.stage_name ?? "",
    slug: row.slug ?? "",
    profileUrl: row.slug ? `${SITE_URL}/artists/${row.slug}` : null,
    profileImage: row.profile_picture_url ?? "",
    headline: row.headline ?? "",
    primaryCategory: row.art_form ?? "",
    specializations: row.art_sub_forms ?? [],
    skills: row.skills ?? [],
    genres: row.genres ?? [],
    languages: row.languages ?? [],
    location: {
      area: row.area ?? "",
      city: row.city ?? "",
      state: row.state ?? "",
      country: row.country ?? "India",
    },
    eventTypes: row.event_types ?? [],
    performanceMode: row.work_mode ?? "",
    willingToTravel: !!row.travel_available,
    startingPrice: row.price_range ?? "",
    pricingUnit: row.pricing_unit ?? "",
    portfolioPreview: (row.performance_image_urls ?? [])[0] ?? null,
    updatedAt: row.updated_at ?? null,
    enquiryUrl: row.slug ? `${SITE_URL}/artists/${row.slug}` : null,
  };
}
