import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { stripOAuthHashIfPresent } from "@/lib/stripOAuthHash";
import { ARTIST_CATEGORIES, EVENT_TYPES, INDIA_STATES } from "@/lib/sharedConfig";
import { postJob } from "@/lib/jobs";
import Container from "@/components/Container";
import Logo from "@/components/Logo";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Select from "@/components/Select";
import Textarea from "@/components/Textarea";
import Card from "@/components/Card";
import LoadingSpinner from "@/components/LoadingSpinner";
import NoIndexMeta from "@/components/NoIndexMeta";

export default function PostJobPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [artForm, setArtForm] = useState("");
  const [eventType, setEventType] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [dateFlexible, setDateFlexible] = useState(false);
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function handleUser(u: { id: string } | null | undefined) {
      if (cancelled) return;
      if (!u) { router.replace({ pathname: "/signup", query: { role: "client", returnTo: "/post-job" } }); return; }
      stripOAuthHashIfPresent();
      const { data } = await supabase.from("clients").select("id").eq("id", u.id).maybeSingle();
      if (cancelled) return;
      if (!data) { router.replace({ pathname: "/client-onboarding", query: { returnTo: "/post-job" } }); return; }
      setUserId(u.id);
      setChecking(false);
    }

    supabase.auth.getSession().then(({ data: { session } }) => handleUser(session?.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      handleUser(session?.user);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [router]);

  const stateCities = state ? (INDIA_STATES[state] ?? []) : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (!title.trim()) { setError("Please give this job a title."); return; }
    if (!artForm) { setError("Please select an artist category."); return; }
    setError(null);
    setSaving(true);
    const { data, error: postError } = await postJob({
      client_id: userId,
      title: title.trim(),
      art_form: artForm,
      event_type: eventType,
      city,
      state,
      event_date: eventDate || null,
      date_flexible: dateFlexible,
      budget_min: budgetMin.trim(),
      budget_max: budgetMax.trim(),
      description: description.trim(),
    });
    setSaving(false);
    if (postError) { setError(postError.message); return; }
    router.push(data?.id ? `/my-jobs?posted=${data.id}` : "/my-jobs");
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[var(--color-page)] flex items-center justify-center">
        <NoIndexMeta />
        <LoadingSpinner size="lg" label="Loading" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-page)]">
      <NoIndexMeta />
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <Container className="flex h-16 items-center justify-between">
          <Logo size="md" />
          <Button href="/artists" variant="ghost" size="sm">Back to Artists</Button>
        </Container>
      </header>

      <Container className="py-10 sm:py-14 max-w-2xl">
        <h1 className="text-3xl">Post a job</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">Describe your event and let artists come to you. Keep it short — you can always add more detail once someone applies.</p>

        <Card className="p-6 mt-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input label="Job title" required placeholder="e.g. Singer needed for wedding sangeet" value={title} onChange={(e) => setTitle(e.target.value)} />

            <div className="grid sm:grid-cols-2 gap-5">
              <Select label="Artist category" required value={artForm} onChange={(e) => setArtForm(e.target.value)}>
                <option value="">Select category</option>
                {ARTIST_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
              <Select label="Event type" optional value={eventType} onChange={(e) => setEventType(e.target.value)}>
                <option value="">Select event type</option>
                {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <Select label="State" optional value={state} onChange={(e) => { setState(e.target.value); setCity(""); }}>
                <option value="">Select state</option>
                {Object.keys(INDIA_STATES).sort().map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
              <Select label="City" optional value={city} onChange={(e) => setCity(e.target.value)} disabled={!state}>
                <option value="">{state ? "Select city" : "Select a state first"}</option>
                {stateCities.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>

            <div className="grid sm:grid-cols-2 gap-5 items-end">
              <Input label="Event date" optional type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} disabled={dateFlexible} />
              <label className="flex items-center gap-2.5 text-sm text-[var(--color-text)] pb-2.5">
                <input type="checkbox" checked={dateFlexible} onChange={(e) => { setDateFlexible(e.target.checked); if (e.target.checked) setEventDate(""); }} className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)]" />
                Date is flexible
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <Input label="Budget — min" optional placeholder="e.g. 10000" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} />
              <Input label="Budget — max" optional placeholder="e.g. 25000" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} />
            </div>

            <Textarea label="Description" optional rows={5} placeholder="What are you looking for? Venue, audience size, duration, anything artists should know." value={description} onChange={(e) => setDescription(e.target.value)} />

            {error && (
              <p className="rounded-[var(--radius-md)] bg-[var(--color-error-soft)] px-4 py-3 text-sm text-[var(--color-error)]" role="alert">{error}</p>
            )}

            <Button type="submit" variant="primary" size="lg" fullWidth disabled={saving}>
              {saving ? "Posting…" : "Post job"}
            </Button>
          </form>
        </Card>
      </Container>
    </div>
  );
}
