import Head from "next/head";

/** Marks a private/authenticated page as non-indexable. Search engines should
 * never be shown dashboards, chat, enquiries, or account pages — access is
 * also enforced separately at the auth + database (RLS) level; this only
 * controls crawler/indexing behaviour. */
export default function NoIndexMeta() {
  return (
    <Head>
      <meta name="robots" content="noindex, nofollow" />
    </Head>
  );
}
