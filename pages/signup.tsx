import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function SignupPage() {
  const router = useRouter();
  const role = useMemo(() => (typeof router.query.role === "string" ? router.query.role : "artist"), [router.query.role]);
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError(null);
  }, [mode]);

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error: authError } =
        mode === "signup"
          ? await supabase.auth.signUp({ email, password })
          : await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      if (role === "artist") {
        router.replace("/create-profile");
      } else {
        router.replace("/client-onboarding");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    try {
      const redirectPath = role === "artist" ? "/create-profile" : "/client-onboarding";
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}${redirectPath}` },
      });
      if (authError) throw authError;
      // On success, Supabase redirects the browser to Google and back — no further code runs here.
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Video Background */}
      <video
        autoPlay
        loop
        muted={true}
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src="/background-video.mp4" type="video/mp4" />
        {/* Fallback for browsers that don't support video */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900" />
      </video>

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Header with Logo */}
      <header className="relative z-10 p-4">
        <div className="flex items-center">
          <img
            src="/logo_2.png"
            alt="Artisync Logo"
            className="h-16 w-auto object-contain"
          />
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 flex min-h-screen items-start justify-center px-6 pt-1">
        <div className="w-full max-w-md">
          {/* Auth Card */}
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-8 shadow-2xl">
            {/* Role Indicator */}
            <div className="mb-6 text-center">
              <div className="inline-flex items-center space-x-2 rounded-full bg-white/20 px-4 py-2 text-sm text-white">
                <span>Role:</span>
                <span className="font-medium">{role}</span>
                <Link 
                  href={{ pathname: "/signup", query: { role: role === "artist" ? "client" : "artist" } }}
                  className="ml-2 text-white/80 hover:text-white underline text-xs"
                >
                  Switch
                </Link>
              </div>
            </div>

            {/* Mode Tabs */}
            <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-white/10 p-1">
              <button
                onClick={() => setMode("signin")}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                  mode === "signin" 
                    ? "bg-white text-gray-900 shadow-lg" 
                    : "text-white/80 hover:text-white"
                }`}
              >
                Sign in
              </button>
              <button
                onClick={() => setMode("signup")}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                  mode === "signup" 
                    ? "bg-white text-gray-900 shadow-lg" 
                    : "text-white/80 hover:text-white"
                }`}
              >
                Create account
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div>
                <input
                  type="email"
                  required
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border-0 bg-white/20 px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                />
              </div>
              <div>
                <input
                  type="password"
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border-0 bg-white/20 px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                />
              </div>
              
              {error && (
                <div className="rounded-lg bg-red-500/20 border border-red-500/30 p-3">
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-gray-900 hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
              >
                {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
              </button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center">
              <div className="flex-1 border-t border-white/20" />
              <span className="px-4 text-sm text-white/60">or</span>
              <div className="flex-1 border-t border-white/20" />
            </div>

            {/* Google Button */}
            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-white hover:bg-white/20 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-3"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-5 w-5">
                <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12 s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C33.046,6.053,28.715,4,24,4C12.955,4,4,12.955,4,24 s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,16.108,18.961,13,24,4C15.316,4,7.846,9.337,6.306,14.691z"/>
                <path fill="#4CAF50" d="M24,44c4.686,0,8.961-1.802,12.191-4.864l-5.624-4.73C28.542,36.262,26.392,37,24,37c-5.203,0-9.621-3.343-11.283-8.011 l-6.558,5.046C7.67,39.556,15.138,44,24,44z"/>
                <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12 c0-1.258,0.217-2.466,0.612-3.592l6.558-5.046C5.239,13.854,4,18.779,4,24c0,11.045,8.955,20,20,20s20-8.955,20-20 C44,22.659,43.862,21.35,43.611,20.083z"/>
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Footer */}
            <div className="mt-6 text-center">
              <p className="text-xs text-white/60">
                By continuing, you agree to our Terms and Privacy Policy
              </p>
              <Link href="/" className="mt-3 inline-block text-sm text-white/80 hover:text-white underline">
                Back to home
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Mute Button */}
      <button
        onClick={() => {
          const video = document.querySelector('video');
          if (video) {
            video.muted = !video.muted;
          }
        }}
        className="fixed bottom-6 left-6 z-20 rounded-full bg-white/20 backdrop-blur-sm p-3 text-white hover:bg-white/30 transition-all duration-200"
        title="Toggle sound"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M6.343 6.343a1 1 0 011.414 0l8.486 8.486a1 1 0 01-1.414 1.414L6.343 7.757a1 1 0 010-1.414z" />
        </svg>
      </button>
    </div>
  );
}


