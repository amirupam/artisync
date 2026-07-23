import Head from "next/head";
import AppHeader from "@/components/AppHeader";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import { SITE_URL, SITE_NAME } from "@/lib/siteConfig";

// TODO: set a real support inbox once one exists, then this section will
// render automatically — left blank deliberately rather than fabricating one.
const SUPPORT_EMAIL = "";

const title = "Contact us";
const description = `Get in touch with the ${SITE_NAME} team.`;

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[var(--color-page)] flex flex-col">
      <Head>
        <title>{title} | {SITE_NAME}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={`${SITE_URL}/contact`} />
      </Head>
      <AppHeader />
      <Container className="py-14 sm:py-20 flex-1 max-w-2xl">
        <h1 className="text-3xl">{title}</h1>
        <div className="mt-6 space-y-5 text-[var(--color-text-secondary)] leading-relaxed">
          {SUPPORT_EMAIL ? (
            <p>
              For account issues, reporting a problem, or general questions, email us at{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[var(--color-accent)] hover:underline">{SUPPORT_EMAIL}</a>.
            </p>
          ) : (
            <p>
              A dedicated support inbox isn&apos;t set up yet. If you&apos;ve run into an issue with
              a specific conversation, use the Report option inside that conversation — it reaches
              the right place fastest.
            </p>
          )}
          <p>
            {SITE_NAME} doesn&apos;t manage bookings, payments, or disputes between clients and
            artists directly — those are handled between the two parties.
          </p>
        </div>
      </Container>
      <Footer />
    </div>
  );
}
