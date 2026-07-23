import { describe, it, expect } from "vitest";
import { slugify, buildSlugLookup } from "./slugify";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Anchor / Emcee")).toBe("anchor-emcee");
    expect(slugify("Hyderabad")).toBe("hyderabad");
    expect(slugify("Spoken Word / Poetry")).toBe("spoken-word-poetry");
  });

  it("strips leading/trailing hyphens produced by punctuation", () => {
    expect(slugify("  Actor / Theatre  ")).toBe("actor-theatre");
  });
});

describe("buildSlugLookup", () => {
  it("maps a slug back to its original display value", () => {
    const lookup = buildSlugLookup(["Singer", "Anchor / Emcee"]);
    expect(lookup["singer"]).toBe("Singer");
    expect(lookup["anchor-emcee"]).toBe("Anchor / Emcee");
  });
});
