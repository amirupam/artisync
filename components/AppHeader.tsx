import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import Container from "./Container";
import Logo from "./Logo";
import Button from "./Button";

const NAV_LINKS = [
  { label: "Find Artists", href: "/artists" },
  { label: "For Artists", href: "/#for-artists" },
  { label: "How It Works", href: "/#how-it-works" },
];

export default function AppHeader() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [dashboardHref, setDashboardHref] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile(uid: string) {
      const { data: artistRow } = await supabase.from("artists").select("full_name, stage_name, profile_picture_url").eq("id", uid).maybeSingle();
      if (cancelled) return;
      if (artistRow) {
        setDisplayName(artistRow.stage_name || artistRow.full_name || "Artist");
        setPhotoUrl(artistRow.profile_picture_url || "");
        setDashboardHref("/dashboard");
        return;
      }
      const { data: clientRow } = await supabase.from("clients").select("full_name").eq("id", uid).maybeSingle();
      if (cancelled) return;
      if (clientRow) {
        setDisplayName(clientRow.full_name || "Client");
        setPhotoUrl("");
        setDashboardHref("/artists");
        return;
      }
      setDisplayName(null);
      setPhotoUrl("");
      setDashboardHref(null);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (uid) loadProfile(uid);
      else { setDisplayName(null); setPhotoUrl(""); setDashboardHref(null); }
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setMenuOpen(false);
    setOpen(false);
    router.push("/");
  }

  const loggedIn = !!userId;

  return (
    <header className="sticky top-0 z-40 bg-[var(--color-surface)]/90 backdrop-blur-md border-b border-[var(--color-border)]">
      <Container className="flex h-16 items-center justify-between">
        <Logo size="md" />

        <nav className="hidden lg:flex items-center gap-8" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] rounded-sm"
            >
              {link.label}
            </a>
          ))}
          {dashboardHref && (
            <a
              href={dashboardHref}
              className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] rounded-sm"
            >
              Dashboard
            </a>
          )}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          {loggedIn ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                className="flex items-center gap-2 rounded-full pr-3 pl-1 py-1 hover:bg-[var(--color-primary-soft)]
                  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              >
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <span className="w-8 h-8 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-sm font-bold">
                    {(displayName || "?").charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="text-sm font-semibold text-[var(--color-text)] max-w-[120px] truncate">{displayName || "Account"}</span>
                <svg className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-md)] py-1 z-10">
                  {dashboardHref && (
                    <a href={dashboardHref} className="block px-4 py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-primary-soft)]">Dashboard</a>
                  )}
                  <button type="button" onClick={handleSignOut} className="w-full text-left px-4 py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-primary-soft)]">Sign out</button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Button href="/signup?role=artist" variant="ghost" size="md">Sign In</Button>
              <Button href="/signup?role=artist" variant="primary" size="md">Join ArtiSync</Button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="lg:hidden inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text)]
            hover:bg-[var(--color-primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
            )}
          </svg>
        </button>
      </Container>

      {open && (
        <div className="lg:hidden border-t border-[var(--color-border)] bg-[var(--color-surface)]">
          <Container className="flex flex-col gap-1 py-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-[var(--radius-md)] px-3 py-3 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-primary-soft)]
                  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              >
                {link.label}
              </a>
            ))}
            {dashboardHref && (
              <a
                href={dashboardHref}
                onClick={() => setOpen(false)}
                className="rounded-[var(--radius-md)] px-3 py-3 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-primary-soft)]
                  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              >
                Dashboard
              </a>
            )}
            <div className="mt-2 flex flex-col gap-2 px-1">
              {loggedIn ? (
                <Button type="button" variant="outline" size="md" fullWidth onClick={handleSignOut}>Sign out</Button>
              ) : (
                <>
                  <Button href="/signup?role=artist" variant="outline" size="md" fullWidth>Sign In</Button>
                  <Button href="/signup?role=artist" variant="primary" size="md" fullWidth>Join ArtiSync</Button>
                </>
              )}
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}
