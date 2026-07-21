/**
 * Supabase's OAuth/recovery redirect leaves an access_token (or a bare "#")
 * in the URL after the client consumes it. Strip only that — not a real
 * in-app anchor like "#section-portfolio" used for deep-linking.
 */
export function stripOAuthHashIfPresent() {
  const hash = window.location.hash;
  if (hash === "#" || hash.includes("access_token") || hash.includes("refresh_token")) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}
