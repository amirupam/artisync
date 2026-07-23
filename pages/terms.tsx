import Head from "next/head";
import AppHeader from "@/components/AppHeader";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import { SITE_URL, SITE_NAME } from "@/lib/siteConfig";

const title = "Terms of Service";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--color-page)] flex flex-col">
      <Head>
        <title>{title} | {SITE_NAME}</title>
        <meta name="description" content={`The terms that govern using ${SITE_NAME}.`} />
        <link rel="canonical" href={`${SITE_URL}/terms`} />
        <meta name="robots" content="noindex, follow" />
      </Head>
      <AppHeader />
      <Container className="py-14 sm:py-20 flex-1 max-w-2xl">
        <div className="mb-8 rounded-[var(--radius-md)] border border-[var(--color-warning)] bg-[var(--color-warning-soft)] p-4 text-sm text-[var(--color-text)]">
          <strong>Draft — not yet legally reviewed.</strong> This describes how the product actually
          works today. It has not been reviewed by a lawyer and should not be treated as a finished,
          binding agreement until it has been.
        </div>
        <h1 className="text-3xl">{title}</h1>
        <div className="mt-6 space-y-6 text-[var(--color-text-secondary)] leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-[var(--color-text)] mb-2">What {SITE_NAME} is</h2>
            <p>{SITE_NAME} is a directory and enquiry platform connecting clients with performing and creative artists. We provide discovery, profiles, and a private messaging system — we are not a party to any booking, performance agreement, or payment between a client and an artist.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-[var(--color-text)] mb-2">Accounts</h2>
            <p>You&apos;re responsible for the accuracy of the information on your profile and for keeping your account credentials secure. Artist profiles should reflect real people, real work, and real availability.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-[var(--color-text)] mb-2">Acceptable use</h2>
            <p>Don&apos;t use the platform to harass, scam, or misrepresent yourself. Don&apos;t attempt to circumvent the private-messaging or contact-sharing system to extract another user&apos;s contact details without their consent. Reports and blocks are available inside every conversation.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-[var(--color-text)] mb-2">No booking or payment guarantee</h2>
            <p>{SITE_NAME} does not verify the outcome of any booking, does not hold funds, and is not responsible for disputes arising from an engagement between a client and an artist.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-[var(--color-text)] mb-2">Changes</h2>
            <p>These terms may be updated as the product changes. Material changes will be reflected on this page.</p>
          </section>
        </div>
      </Container>
      <Footer />
    </div>
  );
}
