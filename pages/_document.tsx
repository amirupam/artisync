import { Html, Head, Main, NextScript } from "next/document";

// No <title>/<meta description> here — a hardcoded document-level title
// silently wins over every page's own next/head metadata (confirmed: it
// suppressed the unique per-artist and per-listing titles added in the SEO
// work). Defaults now live in _app.tsx, where individual pages can override
// them via their own next/head.
export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" type="image/png" href="/logo_2.png" />
        <link rel="apple-touch-icon" href="/logo_2.png" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
