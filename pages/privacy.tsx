import Head from "next/head";
import AppHeader from "@/components/AppHeader";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import { SITE_URL, SITE_NAME } from "@/lib/siteConfig";

const title = "Privacy Policy";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--color-page)] flex flex-col">
      <Head>
        <title>{title} | {SITE_NAME}</title>
        <meta name="description" content={`How ${SITE_NAME} collects, uses, and protects your data.`} />
        <link rel="canonical" href={`${SITE_URL}/privacy`} />
        <meta name="robots" content="noindex, follow" />
      </Head>
      <AppHeader />
      <Container className="py-14 sm:py-20 flex-1 max-w-2xl">
        <div className="mb-8 rounded-[var(--radius-md)] border border-[var(--color-warning)] bg-[var(--color-warning-soft)] p-4 text-sm text-[var(--color-text)]">
          <strong>Draft — not yet legally reviewed.</strong> This describes how the product actually
          works today. It has not been reviewed by a lawyer and should not be treated as a finished,
          binding policy until it has been.
        </div>
        <h1 className="text-3xl">{title}</h1>
        <div className="mt-6 space-y-6 text-[var(--color-text-secondary)] leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-[var(--color-text)] mb-2">What we collect</h2>
            <p>Account email and password (via our authentication provider), profile information you choose to add (name, bio, portfolio, pricing, location), and messages you send within enquiries and conversations.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-[var(--color-text)] mb-2">Contact details</h2>
            <p>An artist&apos;s phone number, email, and website are never shown on their public profile or in any public page, API response, or search result. They are only revealed to a specific client after the artist explicitly approves a contact-sharing request from that client, and can be revoked afterward.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-[var(--color-text)] mb-2">Who can see your data</h2>
            <p>Published artist profiles (excluding contact details) are public and visible to any visitor, including search engines. Enquiries, conversations, and messages are visible only to the two people involved, enforced at the database level, not just in the app&apos;s interface.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-[var(--color-text)] mb-2">What we don&apos;t do</h2>
            <p>We don&apos;t sell your data. We don&apos;t process payments or store payment details — nothing on this platform handles money. We don&apos;t share your private contact information with anyone without your explicit approval.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-[var(--color-text)] mb-2">Your choices</h2>
            <p>You can edit or delete your profile information, unpublish your artist profile at any time, and block or report another user from within a conversation.</p>
          </section>
        </div>
      </Container>
      <Footer />
    </div>
  );
}
