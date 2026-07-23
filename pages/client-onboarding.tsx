import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { stripOAuthHashIfPresent } from "@/lib/stripOAuthHash";
import { resolveEntryPath } from "@/lib/roleRouting";
import Container from "@/components/Container";
import Logo from "@/components/Logo";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Select from "@/components/Select";
import LoadingSpinner from "@/components/LoadingSpinner";
import NoIndexMeta from "@/components/NoIndexMeta";
import { INDIA_STATES } from "@/lib/sharedConfig";

export default function ClientOnboardingPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: "", phone: "", state: "", city: "" });

  useEffect(() => {
    let cancelled = false;

    async function handleUser(u: { id: string } | null | undefined) {
      if (cancelled) return;
      if (!u) {
        router.replace({ pathname: "/signup", query: { role: "client" } });
        return;
      }
      stripOAuthHashIfPresent();
      setUserId(u.id);
      const { data } = await supabase.from("clients").select("id").eq("id", u.id).maybeSingle();
      if (cancelled) return;
      if (data) {
        router.replace(await resolveEntryPath(u.id, "client"));
        return;
      }
      setChecking(false);
    }

    supabase.auth.getSession().then(({ data: { session } }) => handleUser(session?.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      handleUser(session?.user);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [router]);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    if (field === "state") setForm((f) => ({ ...f, state: value, city: "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim()) { setError("Please enter your name"); return; }
    if (!userId) return;
    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: dbError } = await supabase.from("clients").insert({
        id: userId,
        full_name: form.fullName.trim(),
        phone: form.phone.trim(),
        state: form.state,
        city: form.city,
        email: user?.email ?? "",
      });
      if (dbError) throw dbError;
      const returnTo = typeof router.query.returnTo === "string" ? router.query.returnTo : undefined;
      router.replace({ pathname: "/client-preferences", query: returnTo ? { returnTo } : undefined });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[var(--color-page)] flex items-center justify-center">
        <NoIndexMeta />
        <LoadingSpinner size="lg" label="Loading" />
      </div>
    );
  }

  const cities = form.state ? (INDIA_STATES[form.state] ?? []) : [];

  return (
    <div className="min-h-screen bg-[var(--color-page)] flex flex-col">
      <NoIndexMeta />
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <Container className="flex h-16 items-center">
          <Logo size="md" />
        </Container>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-14">
        <div className="w-full max-w-[440px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-[var(--shadow-sm)]">
          <div className="mb-6">
            <h1 className="text-2xl">Almost there!</h1>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Tell us a bit about yourself so artists can reach you.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input label="Your name" required value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
            <Input label="Phone number" optional type="tel" placeholder="+91 XXXXX XXXXX" value={form.phone} onChange={(e) => set("phone", e.target.value)} />

            <Select label="State" optional value={form.state} onChange={(e) => set("state", e.target.value)}>
              <option value="">Select state</option>
              {Object.keys(INDIA_STATES).sort().map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>

            {cities.length > 0 && (
              <Select label="City" optional value={form.city} onChange={(e) => set("city", e.target.value)}>
                <option value="">Select city</option>
                {cities.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            )}

            {error && (
              <p className="rounded-[var(--radius-md)] bg-[var(--color-error-soft)] px-4 py-3 text-sm text-[var(--color-error)]" role="alert">{error}</p>
            )}

            <Button type="submit" variant="primary" size="lg" fullWidth disabled={saving}>
              {saving ? "Saving…" : "Continue"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
