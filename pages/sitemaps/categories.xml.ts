import type { GetServerSideProps } from "next";
import { supabase } from "@/lib/supabaseClient";
import { buildUrlsetXml } from "@/lib/sitemapXml";
import { SITE_URL } from "@/lib/siteConfig";
import { ARTIST_CATEGORIES } from "@/lib/sharedConfig";
import { LISTING_INDEX_THRESHOLD } from "@/lib/seoMeta";
import { slugify } from "@/lib/slugify";

// Only category landing pages with at least LISTING_INDEX_THRESHOLD
// published artists are included — thin/empty category pages stay
// reachable (for a returning artist) but out of the sitemap and noindexed,
// matching the same rule the listing page itself enforces.
export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const counts = await Promise.all(
    ARTIST_CATEGORIES.map(async (category) => {
      const { count } = await supabase.from("artists_public").select("id", { count: "exact", head: true }).eq("art_form", category);
      return { category, count: count ?? 0 };
    })
  );

  const xml = buildUrlsetXml(
    counts
      .filter((c) => c.count >= LISTING_INDEX_THRESHOLD)
      .map((c) => ({ loc: `${SITE_URL}/artists/${slugify(c.category)}` }))
  );

  res.setHeader("Content-Type", "application/xml");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.write(xml);
  res.end();
  return { props: {} };
};

export default function CategoriesSitemap() {
  return null;
}
