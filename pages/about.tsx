import Head from "next/head";
import AppHeader from "@/components/AppHeader";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import { SITE_URL, SITE_NAME } from "@/lib/siteConfig";

const title = `About ${SITE_NAME}`;
const description = `${SITE_NAME} connects clients with performing and creative artists across India — discover portfolios, compare artists, and enquire directly.`;

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[var(--color-page)] flex flex-col">
      <Head>
        <title>{title} | {SITE_NAME}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={`${SITE_URL}/about`} />
      </Head>
      <AppHeader />
      <Container className="py-14 sm:py-20 flex-1 max-w-3xl">
        <h1 className="text-3xl">{title}</h1>
        <div className="mt-6 space-y-5 text-[var(--color-text-secondary)] leading-relaxed">
          <p>
            {SITE_NAME} is a directory and enquiry platform for performing and creative artists —
            singers, musicians, dancers, DJs, photographers, and more. Artists build a public profile
            with their portfolio, pricing, and availability; clients browse and filter by category,
            location, language, and budget, then send a structured enquiry directly to the artist
            they&apos;re interested in.
          </p>
          <p>
            Contact details stay private by default. A conversation only opens once an artist
            responds to an enquiry, and phone numbers or emails are only ever shared if both sides
            explicitly agree to exchange them.
          </p>
          <p>
            {SITE_NAME} doesn&apos;t take a booking fee, doesn&apos;t process payments, and doesn&apos;t
            manage contracts between clients and artists — it&apos;s a discovery and first-contact
            layer. What happens after an enquiry (pricing negotiation, contracts, payment) is between
            the client and the artist directly.
          </p>
        </div>
      </Container>
      <Footer />
    </div>
  );
}
