/** Converts a display value ("Anchor / Emcee", "Hyderabad") into a URL-safe slug ("anchor-emcee", "hyderabad"). */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Builds a slug -> original-value lookup for a list of controlled display values. */
export function buildSlugLookup(values: string[]): Record<string, string> {
  const lookup: Record<string, string> = {};
  for (const value of values) {
    lookup[slugify(value)] = value;
  }
  return lookup;
}
