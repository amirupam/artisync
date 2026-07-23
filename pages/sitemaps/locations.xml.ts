import type { GetServerSideProps } from "next";
import { supabase } from "@/lib/supabaseClient";
import { buildUrlsetXml } from "@/lib/sitemapXml";
import { SITE_URL } from "@/lib/siteConfig";
import { ALL_CITIES } from "@/lib/sharedConfig";
import { LISTING_INDEX_THRESHOLD } from "@/lib/seoMeta";
import { slugify } from "@/lib/slugify";

// City landing pages, same indexability rule as categories. Checking every
// city in ALL_CITIES individually doesn't scale well as the city list
// grows — cities with zero artists resolve to a single fast "count" query,
// so this stays reasonable while the platform is small. Revisit with a
// single grouped query (e.g. a materialized view of city -> artist counts)
// if this list grows into the hundreds and cold-start latency becomes an issue.
export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const counts = await Promise.all(
    ALL_CITIES.map(async (city) => {
      const { count } = await supabase.from("artists_public").select("id", { count: "exact", head: true }).eq("city", city);
      return { city, count: count ?? 0 };
    })
  );

  const xml = buildUrlsetXml(
    counts
      .filter((c) => c.count >= LISTING_INDEX_THRESHOLD)
      .map((c) => ({ loc: `${SITE_URL}/artists/${slugify(c.city)}` }))
  );

  res.setHeader("Content-Type", "application/xml");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.write(xml);
  res.end();
  return { props: {} };
};

export default function LocationsSitemap() {
  return null;
}
