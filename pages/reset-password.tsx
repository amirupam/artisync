import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { stripOAuthHashIfPresent } from "@/lib/stripOAuthHash";
import Logo from "@/components/Logo";
import Container from "@/components/Container";
import Button from "@/components/Button";
import PasswordInput from "@/components/PasswordInput";
import LoadingSpinner from "@/components/LoadingSpinner";

const MIN_PASSWORD_LENGTH = 6;

export default function ResetPasswordPage() {
  const [checking, setChecking] = useState(true);
  const [validSession, setValidSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      stripOAuthHashIfPresent();
      setValidSession(!!session);
      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      if (cancelled) return;
      setValidSession(!!session);
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  function validate(): boolean {
    const next: typeof fieldErrors = {};
    if (password.length < MIN_PASSWORD_LENGTH) next.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    if (confirmPassword !== password) next.confirmPassword = "Passwords do not match.";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-page)] flex flex-col">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <Container className="flex h-16 items-center">
          <Logo size="md" />
        </Container>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-14">
        <div className="w-full max-w-[440px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-[var(--shadow-sm)]">
          {checking ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="lg" label="Checking your reset link" />
            </div>
          ) : success ? (
            <>
              <h1 className="text-2xl">Password updated</h1>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                Your password has been changed successfully.
              </p>
              <Button href="/signup" variant="primary" size="lg" fullWidth className="mt-6">
                Continue to sign in
              </Button>
            </>
          ) : !validSession ? (
            <>
              <h1 className="text-2xl">Link expired</h1>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                This password reset link is invalid or has expired. Request a new one from the sign-in page.
              </p>
              <Button href="/signup" variant="primary" size="lg" fullWidth className="mt-6">
                Back to sign in
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-2xl">Set a new password</h1>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                Choose a new password for your account.
              </p>
              <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
                <PasswordInput
                  label="New password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={fieldErrors.password}
                  hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
                />
                <PasswordInput
                  label="Confirm new password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={fieldErrors.confirmPassword}
                />
                {error && (
                  <p className="rounded-[var(--radius-md)] bg-[var(--color-error-soft)] px-4 py-3 text-sm text-[var(--color-error)]" role="alert">
                    {error}
                  </p>
                )}
                <Button type="submit" variant="primary" size="lg" fullWidth disabled={loading}>
                  {loading ? "Updating…" : "Update password"}
                </Button>
              </form>
            </>
          )}

          <div className="mt-6 text-center">
            <Link href="/" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
