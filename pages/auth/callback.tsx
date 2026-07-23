import { useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { resolveEntryPath, type EntryRole } from "@/lib/roleRouting";
import { stripOAuthHashIfPresent } from "@/lib/stripOAuthHash";
import LoadingSpinner from "@/components/LoadingSpinner";
import NoIndexMeta from "@/components/NoIndexMeta";

/**
 * Landing point for OAuth sign-in (Google). Unlike email/password auth, an
 * OAuth redirect can't run our JS mid-flow, so the role-aware destination
 * (dashboard vs onboarding vs discovery) has to be resolved here instead,
 * once the browser is back on our own domain with a session.
 */
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    const role: EntryRole = router.query.role === "client" ? "client" : "artist";
    let cancelled = false;

    async function go() {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      stripOAuthHashIfPresent();
      if (!session?.user) {
        router.replace({ pathname: "/signup", query: { role } });
        return;
      }
      const destination = await resolveEntryPath(session.user.id, role);
      const returnTo = typeof router.query.returnTo === "string" ? router.query.returnTo : undefined;
      if (cancelled) return;
      if (returnTo && destination === "/artists") {
        router.replace(returnTo);
      } else if (returnTo && (destination === "/client-onboarding" || destination === "/client-preferences")) {
        router.replace({ pathname: destination, query: { returnTo } });
      } else {
        router.replace(destination);
      }
    }

    go();
    return () => { cancelled = true; };
  }, [router, router.isReady]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-page)]">
      <NoIndexMeta />
      <LoadingSpinner size="lg" label="Signing you in" />
    </div>
  );
}
