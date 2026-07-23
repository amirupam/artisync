import type { GetServerSideProps } from "next";
import { buildUrlsetXml } from "@/lib/sitemapXml";
import { SITE_URL } from "@/lib/siteConfig";

// Static, always-public, high-quality pages. Extend this list as more
// trust/editorial pages (About, Privacy, Terms, Contact — Phase 16) are built.
export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const xml = buildUrlsetXml([
    { loc: `${SITE_URL}/` },
    { loc: `${SITE_URL}/artists` },
    { loc: `${SITE_URL}/about` },
    { loc: `${SITE_URL}/contact` },
    // /privacy and /terms are intentionally excluded — still marked noindex
    // (draft, not yet legally reviewed; see the banner on those pages).
  ]);
  res.setHeader("Content-Type", "application/xml");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.write(xml);
  res.end();
  return { props: {} };
};

export default function ContentSitemap() {
  return null;
}
