import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";

/** Shared artist-side nav — Dashboard / Discover Artists / Sign out. Shown on the dashboard and (for artist viewers) the discovery page. */
export default function ArtistNav({ active, className = "" }: { active: "dashboard" | "discover"; className?: string }) {
  const router = useRouter();

  function tabClass(tab: "dashboard" | "discover") {
    return active === tab
      ? "text-sm font-bold text-[var(--color-text)]"
      : "text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)]";
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  return (
    <div className={`flex items-center gap-5 ${className}`}>
      <Link href="/dashboard" className={tabClass("dashboard")}>Dashboard</Link>
      <Link href="/artists" className={tabClass("discover")}>Discover Artists</Link>
      <button type="button" onClick={handleSignOut} className="text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
        Sign out
      </button>
    </div>
  );
}
