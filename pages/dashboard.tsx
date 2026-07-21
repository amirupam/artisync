import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase, mapArtistRow, type ArtistProfile } from "@/lib/supabaseClient";
import { getArtistProfileCompleteness } from "@/lib/artistProfileCompleteness";
import { stripOAuthHashIfPresent } from "@/lib/stripOAuthHash";
import Container from "@/components/Container";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Logo from "@/components/Logo";
import LoadingSpinner from "@/components/LoadingSpinner";

type Action = {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
};

export default function DashboardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ArtistProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function handleUser(u: { id: string } | null | undefined) {
      if (cancelled) return;
      if (!u) { router.replace({ pathname: "/signup", query: { role: "artist" } }); return; }
      stripOAuthHashIfPresent();
      setUserId(u.id);
      const { data: d } = await supabase.from("artists").select("*").eq("id", u.id).maybeSingle();
      if (cancelled) return;
      if (!d) {
        // Safety net: no profile yet, so this isn't a valid dashboard visit.
        router.replace("/create-profile");
        return;
      }
      setProfile(mapArtistRow(d));
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data: { session } }) => handleUser(session?.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      handleUser(session?.user);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [router]);

  if (loading || !profile || !userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-page)]">
        <LoadingSpinner size="lg" label="Loading your dashboard" />
      </div>
    );
  }

  const completeness = getArtistProfileCompleteness(profile);

  const actions: Action[] = [
    {
      title: "View My Profile",
      description: "See your profile the way you last saved it.",
      href: "/profile-preview",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />,
    },
    {
      title: "Edit Profile",
      description: "Update your details, bio, and pricing.",
      href: "/create-profile",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />,
    },
    {
      title: "Add Portfolio",
      description: "Upload performance photos and videos.",
      href: "/create-profile#section-portfolio",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.19 2.19 0 00-1.854-1.025h-3.196a2.19 2.19 0 00-1.854 1.025l-.822 1.316zM16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />,
    },
    {
      title: "Update Availability",
      description: "Keep your pricing and details current.",
      href: "/create-profile#section-location",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />,
    },
    {
      title: "Preview Public Profile",
      description: "See exactly what clients see when they find you.",
      href: `/artist/${userId}`,
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />,
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-page)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <Container className="flex h-16 items-center justify-between">
          <Logo size="md" />
          <Button href="/" variant="ghost" size="sm">Back to home</Button>
        </Container>
      </header>

      <Container className="py-10 sm:py-14">
        <h1 className="text-3xl">Welcome back{profile.fullName ? `, ${profile.fullName}` : ""}</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">Here&rsquo;s your ArtiSync artist dashboard.</p>

        {/* Profile completion indicator */}
        <div className="mt-8 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--color-text)]">Profile completeness</h2>
            <span className="text-sm font-bold text-[var(--color-accent)]">{completeness.percentage}%</span>
          </div>
          <div className="mt-3 h-2.5 w-full rounded-full bg-[var(--color-primary-soft)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500"
              style={{ width: `${completeness.percentage}%` }}
              role="progressbar"
              aria-valuenow={completeness.percentage}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          {!completeness.publishable && (
            <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
              Missing: {completeness.missingFields.join(", ")}
            </p>
          )}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {actions.map((action) => (
            <Card key={action.title} href={action.href} className="p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{action.icon}</svg>
              </div>
              <h3 className="mt-4 text-base font-semibold text-[var(--color-text)]">{action.title}</h3>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{action.description}</p>
            </Card>
          ))}
        </div>
      </Container>
    </div>
  );
}
