import type { NextPage } from "next";
import Link from "next/link";
import Container from "@/components/Container";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import AppHeader from "@/components/AppHeader";
import Footer from "@/components/Footer";
import { ARTIST_CATEGORIES } from "@/lib/sharedConfig";
import { slugify } from "@/lib/slugify";

const BENEFITS = [
  {
    title: "Discover artists across multiple creative fields",
    description: "From music and dance to comedy and photography, find talent for any occasion.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
    ),
  },
  {
    title: "Explore portfolios before contacting",
    description: "Browse photos, videos, and details so you know exactly who you're booking.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.25 12s3.75-7.5 9.75-7.5 9.75 7.5 9.75 7.5-3.75 7.5-9.75 7.5S2.25 12 2.25 12z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    ),
  },
  {
    title: "Filter by skills, language, location, and budget",
    description: "Narrow your search so you spend time only on the right fit.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
    ),
  },
  {
    title: "Connect directly for opportunities and bookings",
    description: "No middlemen — reach out and start the conversation right away.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8.25 10.5h7.5m-7.5 3H12M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
  },
];

const CLIENT_STEPS = [
  "Tell us what you need",
  "Discover suitable artists",
  "View profiles and portfolios",
  "Contact the right artist",
];

const ARTIST_STEPS = [
  "Create your profile",
  "Add skills and portfolio",
  "Receive relevant enquiries",
  "Connect with clients",
];

const Home: NextPage = () => {
  return (
    <div className="min-h-screen bg-[var(--color-page)]">
      <AppHeader />

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full bg-[var(--color-accent-soft)] blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute top-40 -left-24 h-80 w-80 rounded-full bg-[var(--color-secondary-soft)] blur-3xl" />

        <Container className="relative py-16 sm:py-24 lg:py-28 text-center">
          <Badge variant="accent" className="mb-6">Discover talent. Create together.</Badge>
          <h1 className="mx-auto max-w-3xl text-[var(--color-text)]">
            Where artists and opportunities meet.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base sm:text-lg text-[var(--color-text-secondary)]">
            Discover talented artists for events, performances, workshops, productions, and creative
            collaborations—or showcase your work and connect with new clients.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button href="/artists" variant="primary" size="lg">Find an Artist</Button>
            <Button href="/signup?role=artist" variant="secondary" size="lg">Join as an Artist</Button>
          </div>
          <div className="mt-4">
            <Button href="/signup?role=artist" variant="ghost" size="md">Sign In</Button>
          </div>
        </Container>
      </section>

      {/* ── Role cards ─────────────────────────────────────────────────── */}
      <section id="for-artists">
        <Container className="pb-16 sm:pb-24">
          <div className="grid gap-6 md:grid-cols-2">
            <Card href="/signup?role=artist" className="p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
                </svg>
              </div>
              <h2 className="mt-5 text-2xl">I&rsquo;m an Artist</h2>
              <p className="mt-2 text-[var(--color-text-secondary)]">
                Create your profile, showcase your work, and connect with clients looking for your talent.
              </p>
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-accent)]">
                Join as an Artist
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </span>
            </Card>

            <Card href="/artists" className="p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-secondary-soft)] text-[var(--color-secondary)]">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <h2 className="mt-5 text-2xl">I&rsquo;m a Client</h2>
              <p className="mt-2 text-[var(--color-text-secondary)]">
                Search, compare, and contact artists for your next event, project, or collaboration.
              </p>
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-secondary)]">
                Find an Artist
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </span>
            </Card>
          </div>
        </Container>
      </section>

      {/* ── Benefits ───────────────────────────────────────────────────── */}
      <section className="bg-[var(--color-surface)] border-y border-[var(--color-border)]">
        <Container className="py-16 sm:py-20">
          <h2 className="text-center max-w-2xl mx-auto">Everything you need to find the right fit</h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-2">
            {BENEFITS.map((b) => (
              <div key={b.title} className="flex gap-4">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {b.icon}
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[var(--color-text)]">{b.title}</h3>
                  <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Category preview ──────────────────────────────────────────── */}
      <section>
        <Container className="py-16 sm:py-20">
          <div className="text-center">
            <h2>Talent across every creative field</h2>
            <p className="mt-3 max-w-xl mx-auto text-[var(--color-text-secondary)]">
              Browse artists by category and find the right match for your next event or project.
            </p>
          </div>
          <div className="mt-9 flex flex-wrap justify-center gap-2.5">
            {ARTIST_CATEGORIES.map((c) => (
              <Link key={c} href={`/artists/${slugify(c)}`} className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] rounded-full">
                <Badge variant="neutral" className="text-sm normal-case tracking-normal px-4 py-2 hover:bg-[var(--color-primary)] hover:text-white transition-colors cursor-pointer">
                  {c}s
                </Badge>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      {/* ── How it works ──────────────────────────────────────────────── */}
      <section id="how-it-works" className="bg-[var(--color-surface)] border-y border-[var(--color-border)]">
        <Container className="py-16 sm:py-20">
          <h2 className="text-center">How it works</h2>
          <div className="mt-12 grid gap-10 lg:grid-cols-2">
            <div>
              <Badge variant="secondary" className="mb-5">For Clients</Badge>
              <ol className="space-y-5">
                {CLIENT_STEPS.map((step, i) => (
                  <li key={step} className="flex items-start gap-4">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-secondary-soft)] text-sm font-bold text-[var(--color-secondary)]">
                      {i + 1}
                    </span>
                    <span className="pt-1 text-[var(--color-text)] font-medium">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <Badge variant="accent" className="mb-5">For Artists</Badge>
              <ol className="space-y-5">
                {ARTIST_STEPS.map((step, i) => (
                  <li key={step} className="flex items-start gap-4">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-sm font-bold text-[var(--color-accent)]">
                      {i + 1}
                    </span>
                    <span className="pt-1 text-[var(--color-text)] font-medium">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Container>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────── */}
      <section className="bg-[var(--color-primary)]">
        <Container className="py-16 sm:py-20 text-center">
          <h2 className="text-white">Ready to get started?</h2>
          <p className="mt-3 max-w-xl mx-auto text-[var(--color-text-on-dark-soft)]">
            Join ArtiSync today — whether you&rsquo;re looking to book talent or share yours with the world.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button href="/signup?role=artist" variant="primary" size="lg">Join as an Artist</Button>
            <Button href="/artists" variant="outline" size="lg" className="!text-white !border-white/30 hover:!bg-white/10">
              Find an Artist
            </Button>
          </div>
        </Container>
      </section>

      <Footer />
    </div>
  );
};

export default Home;
