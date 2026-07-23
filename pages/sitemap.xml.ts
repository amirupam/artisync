import type { GetServerSideProps } from "next";
import { buildSitemapIndexXml } from "@/lib/sitemapXml";
import { SITE_URL } from "@/lib/siteConfig";

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const xml = buildSitemapIndexXml([
    `${SITE_URL}/sitemaps/content.xml`,
    `${SITE_URL}/sitemaps/artists.xml`,
    `${SITE_URL}/sitemaps/categories.xml`,
    `${SITE_URL}/sitemaps/locations.xml`,
  ]);
  res.setHeader("Content-Type", "application/xml");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.write(xml);
  res.end();
  return { props: {} };
};

export default function SitemapIndex() {
  return null;
}
