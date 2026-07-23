import type { GetServerSideProps } from "next";
import { supabase } from "@/lib/supabaseClient";

/**
 * Legacy UUID-based profile URL. The canonical public URL is now
 * /artists/{slug} (see pages/artists/[...params].tsx) — this route only
 * exists so links shared before that change keep working. Resolves the id
 * to its current slug and issues a real, permanent HTTP redirect (not a
 * client-side one) so crawlers update their index to the canonical URL.
 * Every request either redirects or 404s, so there's nothing for the page
 * component itself to render.
 */
export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const id = params?.id as string;
  const { data: published } = await supabase.from("artists_public").select("slug").eq("id", id).maybeSingle();
  if (published?.slug) {
    return { redirect: { destination: `/artists/${published.slug}`, permanent: true } };
  }
  return { notFound: true };
};

export default function LegacyArtistIdRedirect() {
  return null;
}
