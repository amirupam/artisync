import { describe, it, expect } from "vitest";
import { buildArtistJsonLd, serializeJsonLd } from "./structuredData";
import type { ArtistProfile } from "./supabaseClient";

function makeProfile(overrides: Partial<ArtistProfile> = {}): ArtistProfile {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    slug: "ananya-sen",
    fullName: "Ananya Sen",
    stageName: "",
    headline: "Bengali & Hindi vocalist",
    profilePictureUrl: "https://example.com/photo.jpg",
    coverBannerUrl: "",
    coverBannerPositionY: 50,
    artForm: "Singer",
    artSubForms: ["Bollywood Singer"],
    skills: [],
    genres: ["Bollywood"],
    instruments: [],
    groupType: "Solo",
    bio: "A passionate performer.",
    state: "Telangana",
    city: "Hyderabad",
    country: "India",
    area: "Gachibowli",
    travelPreference: "",
    youtubeVideos: ["https://youtu.be/dQw4w9WgXcQ"],
    youtubeVideoCaptions: ["Live at a wedding"],
    performanceImageUrls: [],
    performanceImageCaptions: [],
    phone: "9999999999",
    email: "ananya@example.com",
    website: "https://ananyasen.example.com",
    preferredContactMethod: "Phone",
    instagram: "https://instagram.com/ananyasen",
    facebook: "",
    youtube: "",
    experience: "5 years",
    languages: ["Bengali", "Hindi"],
    eventTypes: ["Wedding", "Corporate Event"],
    priceRange: "15000",
    pricingUnit: "Per event",
    priceNegotiable: true,
    availabilityStatus: "Available now",
    workMode: "Offline",
    bookingTypes: [],
    travelAvailable: true,
    eventDuration: "2 hours",
    equipmentInfo: "",
    status: "published",
    latitude: 17.44,
    longitude: 78.35,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildArtistJsonLd", () => {
  it("never includes private contact fields", () => {
    const jsonLd = buildArtistJsonLd(makeProfile());
    const serialized = JSON.stringify(jsonLd);
    expect(serialized).not.toContain("9999999999");
    expect(serialized).not.toContain("ananya@example.com");
    expect(serialized).not.toContain("preferredContactMethod");
  });

  it("uses Person for a solo artist and MusicGroup for a music group", () => {
    const solo = buildArtistJsonLd(makeProfile());
    expect(solo.mainEntity["@type"]).toBe("Person");

    const group = buildArtistJsonLd(makeProfile({ groupType: "Group", artForm: "Musician" }));
    expect(group.mainEntity["@type"]).toBe("MusicGroup");

    const danceGroup = buildArtistJsonLd(makeProfile({ groupType: "Group", artForm: "Dancer" }));
    expect(danceGroup.mainEntity["@type"]).toBe("PerformingGroup");
  });

  it("only includes an offer when a real price exists", () => {
    const withPrice = buildArtistJsonLd(makeProfile());
    expect(withPrice.mainEntity.makesOffer).toBeDefined();
    expect(withPrice.mainEntity.makesOffer.price).toBe("15000");

    const withoutPrice = buildArtistJsonLd(makeProfile({ priceRange: "" }));
    expect(withoutPrice.mainEntity.makesOffer).toBeUndefined();
  });

  it("builds a real per-video thumbnail from the YouTube ID, not a generic image", () => {
    const jsonLd = buildArtistJsonLd(makeProfile());
    expect(jsonLd.video?.[0].thumbnailUrl).toContain("dQw4w9WgXcQ");
  });

  it("never fabricates fields absent from the profile", () => {
    const bare = buildArtistJsonLd(
      makeProfile({ bio: "", website: "", instagram: "", facebook: "", youtube: "", youtubeVideos: [], priceRange: "", languages: [], skills: [], genres: [], artSubForms: [] })
    );
    expect(bare.mainEntity.description).toBeUndefined();
    expect(bare.mainEntity.sameAs).toBeUndefined();
    expect(bare.mainEntity.knowsLanguage).toBeUndefined();
    expect(bare.mainEntity.knowsAbout).toBeUndefined();
    expect(bare.video).toBeUndefined();
  });
});

describe("serializeJsonLd", () => {
  it("escapes '<' so user-supplied text can't break out of the <script> tag", () => {
    const malicious = buildArtistJsonLd(makeProfile({ bio: "Nice bio</script><script>alert(1)</script>" }));
    const serialized = serializeJsonLd(malicious);
    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c/script>");
  });

  it("produces valid, parseable JSON", () => {
    const jsonLd = buildArtistJsonLd(makeProfile());
    const serialized = serializeJsonLd(jsonLd);
    expect(() => JSON.parse(serialized)).not.toThrow();
  });
});
