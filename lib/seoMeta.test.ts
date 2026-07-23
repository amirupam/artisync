import { describe, it, expect } from "vitest";
import { buildArtistTitle, buildArtistDescription, buildListingTitle, buildListingDescription } from "./seoMeta";

describe("buildArtistTitle", () => {
  it("includes category and place when both are known", () => {
    expect(buildArtistTitle({ fullName: "Ananya Sen", stageName: "", artForm: "Singer", area: "Gachibowli", city: "Hyderabad" }))
      .toBe("Ananya Sen — Singer in Gachibowli, Hyderabad | ArtiSync");
  });

  it("degrades gracefully when location is missing", () => {
    expect(buildArtistTitle({ fullName: "Ananya Sen", stageName: "", artForm: "Singer", area: "", city: "" }))
      .toBe("Ananya Sen — Singer | ArtiSync");
  });

  it("never produces an empty title even with no data at all", () => {
    expect(buildArtistTitle({ fullName: "", stageName: "", artForm: "", area: "", city: "" })).toBe("Artist | ArtiSync");
  });

  it("prefers stage name over full name", () => {
    expect(buildArtistTitle({ fullName: "Real Name", stageName: "Stage Name", artForm: "", area: "", city: "" }))
      .toContain("Stage Name");
  });
});

describe("buildArtistDescription", () => {
  it("never leaves the description empty", () => {
    expect(buildArtistDescription({ fullName: "", stageName: "" }).length).toBeGreaterThan(0);
  });
});

describe("buildListingTitle / buildListingDescription", () => {
  it("differs for category-only, city-only, and combined pages", () => {
    const categoryOnly = buildListingTitle("Singer", null);
    const cityOnly = buildListingTitle(null, "Hyderabad");
    const combined = buildListingTitle("Singer", "Hyderabad");
    expect(new Set([categoryOnly, cityOnly, combined]).size).toBe(3);
  });

  it("description reflects the actual result count", () => {
    const desc = buildListingDescription("Singer", "Hyderabad", 7);
    expect(desc).toContain("7");
  });
});
