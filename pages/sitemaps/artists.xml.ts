import type { GetServerSideProps } from "next";
import { supabase } from "@/lib/supabaseClient";
import { buildUrlsetXml } from "@/lib/sitemapXml";
import { SITE_URL } from "@/lib/siteConfig";

// Only published, active, sufficiently-complete profiles — artists_public
// is already filtered to status = 'published' (schema_v9.sql), and
// is_indexable (schema_v10.sql) additionally excludes published profiles
// that are too thin to be worth indexing.
export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const { data } = await supabase.from("artists_public").select("slug, updated_at").not("slug", "is", null).eq("is_indexable", true);

  const xml = buildUrlsetXml(
    (data ?? []).map((row) => ({
      loc: `${SITE_URL}/artists/${row.slug}`,
      lastmod: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    }))
  );

  res.setHeader("Content-Type", "application/xml");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.write(xml);
  res.end();
  return { props: {} };
};

export default function ArtistsSitemap() {
  return null;
}
