import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { geocodeLocation } from "@/lib/geocode";
import { CLIENT_PREFS_DISMISS_KEY } from "@/lib/roleRouting";
import { EMPTY_CLIENT_PREFERENCES, mapClientPreferencesRow, toClientPreferencesRow, type ClientPreferences } from "@/lib/clientPreferences";
import { ARTIST_CATEGORIES, EVENT_TYPES, LANGUAGES, BUDGET_RANGES, PERFORMANCE_MODES, GROUP_TYPE_OPTIONS, EXPERIENCE_PREFERENCES, INDIA_STATES } from "@/lib/sharedConfig";
import { stripOAuthHashIfPresent } from "@/lib/stripOAuthHash";
import { useToast } from "@/components/Toast";
import Container from "@/components/Container";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Select from "@/components/Select";
import Textarea from "@/components/Textarea";
import TagInput from "@/components/TagInput";
import StepIndicator from "@/components/StepIndicator";
import Logo from "@/components/Logo";
import LoadingSpinner from "@/components/LoadingSpinner";
import Badge from "@/components/Badge";
import NoIndexMeta from "@/components/NoIndexMeta";

const STEP_LABELS = ["Artist Type", "Event", "Location & Mode", "Date & Duration", "Budget", "Preferences & Review"];

function MultiChip({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button key={opt} type="button"
          onClick={() => onChange(selected.includes(opt) ? selected.filter((x) => x !== opt) : [...selected, opt])}
          className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${
            selected.includes(opt) ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]" : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary)]"
          }`}>
          {opt}
        </button>
      ))}
    </div>
  );
}

function ToggleGroup({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button key={opt} type="button" onClick={() => onChange(opt)}
          className={`min-h-[40px] px-4 py-2 rounded-[var(--radius-md)] text-sm font-semibold border transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${
            value === opt ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]" : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-accent)]"
          }`}>
          {opt}
        </button>
      ))}
    </div>
  );
}

function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return <p className="text-sm font-medium text-[var(--color-text)] mb-2">{children} {optional && <span className="text-[var(--color-text-secondary)] font-normal">(optional)</span>}</p>;
}

export default function ClientPreferencesPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [furthestStep, setFurthestStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ClientPreferences>(EMPTY_CLIENT_PREFERENCES);
  const geocodedRef = useRef<{ query: string; lat: number | null; lng: number | null }>({ query: "", lat: null, lng: null });

  useEffect(() => {
    let cancelled = false;
    async function handleUser(u: { id: string } | null | undefined) {
      if (cancelled) return;
      if (!u) { router.replace({ pathname: "/signup", query: { role: "client" } }); return; }
      stripOAuthHashIfPresent();
      setUserId(u.id);
      const { data } = await supabase.from("client_preferences").select("*").eq("client_id", u.id).maybeSingle();
      if (cancelled) return;
      if (data) {
        const loaded = mapClientPreferencesRow(data);
        setForm(loaded);
        geocodedRef.current = {
          query: [loaded.locality, loaded.city, loaded.state, "India"].filter(Boolean).join(", "),
          lat: loaded.latitude, lng: loaded.longitude,
        };
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

  function update<K extends keyof ClientPreferences>(key: K, value: ClientPreferences[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function destinationAfterExit(): string {
    return typeof router.query.returnTo === "string" ? router.query.returnTo : "/artists";
  }

  async function persist(): Promise<boolean> {
    if (!userId) return false;

    const locationQuery = [form.locality, form.city, form.state, "India"].filter(Boolean).join(", ");
    if (locationQuery && locationQuery !== geocodedRef.current.query) {
      const coords = await geocodeLocation(locationQuery);
      geocodedRef.current = { query: locationQuery, lat: coords?.lat ?? null, lng: coords?.lng ?? null };
    } else if (!locationQuery) {
      geocodedRef.current = { query: "", lat: null, lng: null };
    }

    const row = { ...toClientPreferencesRow(userId, form), latitude: geocodedRef.current.lat, longitude: geocodedRef.current.lng };
    const { error } = await supabase.from("client_preferences").upsert(row);
    return !error;
  }

  async function handleSavePreferences() {
    setSaving(true);
    const ok = await persist();
    setSaving(false);
    showToast(ok ? "Preferences saved" : "Could not save preferences", ok ? "success" : "error");
  }

  async function handleShowMatchingArtists() {
    setSaving(true);
    const ok = await persist();
    setSaving(false);
    if (!ok) {
      showToast("Could not save preferences. Please try again.", "error");
      return;
    }
    router.push(destinationAfterExit());
  }

  function handleSkip() {
    sessionStorage.setItem(CLIENT_PREFS_DISMISS_KEY, "1");
    router.push(destinationAfterExit());
  }

  function handleContinue() {
    const next = Math.min(currentStep + 1, STEP_LABELS.length);
    setCurrentStep(next);
    setFurthestStep((f) => Math.max(f, next));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBack() {
    setCurrentStep((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center bg-[var(--color-page)]"><NoIndexMeta /><LoadingSpinner size="lg" label="Loading" /></div>;
  }

  const stateCities = form.state ? (INDIA_STATES[form.state] ?? []) : [];
  const summaryLocation = [form.locality, form.city, form.state].filter(Boolean).join(", ");
  const summaryBudget = form.budgetNotSure ? "Not sure yet" : form.letArtistsQuote ? "Let artists quote" : [form.budgetMin && `₹${form.budgetMin}`, form.budgetMax && `₹${form.budgetMax}`].filter(Boolean).join(" – ");

  return (
    <div className="min-h-screen bg-[var(--color-page)] pb-20">
      <NoIndexMeta />
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur">
        <Container className="flex h-16 items-center justify-between gap-4">
          <Logo size="sm" />
          <button type="button" onClick={handleSkip} className="text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
            Skip for Now
          </button>
        </Container>
      </header>

      <Container className="pt-8">
        <StepIndicator steps={STEP_LABELS} currentStep={currentStep} furthestStep={furthestStep} onStepClick={(s) => setCurrentStep(s)} />
      </Container>

      <Container className="pt-8 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl">Tell us what you&rsquo;re looking for</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Share a few details and we&rsquo;ll recommend artists who match your event, location, budget, and preferences.
          </p>
        </div>

        <div className="space-y-8">
          {/* Step 1 */}
          {currentStep === 1 && (
            <div>
              <h2 className="text-xl">What kind of artist are you looking for?</h2>
              <div className="mt-5"><MultiChip options={ARTIST_CATEGORIES} selected={form.artistCategories} onChange={(v) => update("artistCategories", v)} /></div>
            </div>
          )}

          {/* Step 2 */}
          {currentStep === 2 && (
            <div>
              <h2 className="text-xl">What are you planning?</h2>
              <div className="mt-5"><MultiChip options={EVENT_TYPES} selected={form.eventTypes} onChange={(v) => update("eventTypes", v)} /></div>
            </div>
          )}

          {/* Step 3 */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <h2 className="text-xl">Location and mode</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select label="State" value={form.state} onChange={(e) => { update("state", e.target.value); update("city", ""); }}>
                  <option value="">Select state</option>
                  {Object.keys(INDIA_STATES).sort().map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
                {stateCities.length > 0 ? (
                  <Select label="City" value={form.city} onChange={(e) => update("city", e.target.value)}>
                    <option value="">Select city</option>
                    {stateCities.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                ) : (
                  <Input label="City" value={form.city} onChange={(e) => update("city", e.target.value)} />
                )}
              </div>
              <Input label="Locality" optional value={form.locality} onChange={(e) => update("locality", e.target.value)} />
              <div>
                <FieldLabel>Online, offline, or either</FieldLabel>
                <ToggleGroup options={PERFORMANCE_MODES} value={form.performanceMode} onChange={(v) => update("performanceMode", v)} />
              </div>
              <label className="flex items-center gap-2.5 text-sm text-[var(--color-text)]">
                <input type="checkbox" checked={form.considerTravellingArtists} onChange={(e) => update("considerTravellingArtists", e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)]" />
                Open to travelling artists
              </label>
              <Input label="Venue" optional value={form.venue} onChange={(e) => update("venue", e.target.value)} hint="Just the venue name, not a full address." />
            </div>
          )}

          {/* Step 4 */}
          {currentStep === 4 && (
            <div className="space-y-5">
              <h2 className="text-xl">Date and duration</h2>
              <Input label="Event date" optional type="date" value={form.eventDate ?? ""} onChange={(e) => update("eventDate", e.target.value)} disabled={form.dateNotDecided} />
              <label className="flex items-center gap-2.5 text-sm text-[var(--color-text)]">
                <input type="checkbox" checked={form.dateNotDecided} onChange={(e) => update("dateNotDecided", e.target.checked)} className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)]" />
                Date not decided yet
              </label>
              <label className="flex items-center gap-2.5 text-sm text-[var(--color-text)]">
                <input type="checkbox" checked={form.dateFlexible} onChange={(e) => update("dateFlexible", e.target.checked)} className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)]" />
                My date is flexible
              </label>
              {form.dateFlexible && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="Earliest date" type="date" value={form.dateRangeStart ?? ""} onChange={(e) => update("dateRangeStart", e.target.value)} />
                  <Input label="Latest date" type="date" value={form.dateRangeEnd ?? ""} onChange={(e) => update("dateRangeEnd", e.target.value)} />
                </div>
              )}
              <Input label="Preferred time" optional value={form.preferredTime} onChange={(e) => update("preferredTime", e.target.value)} hint="e.g. Evening, Afternoon" />
              <Input label="Approximate duration" optional value={form.approximateDuration} onChange={(e) => update("approximateDuration", e.target.value)} hint="e.g. 2 hours, full day" />
              <div>
                <FieldLabel>One-time or recurring</FieldLabel>
                <ToggleGroup options={["One-time", "Recurring"]} value={form.recurrence} onChange={(v) => update("recurrence", v)} />
              </div>
            </div>
          )}

          {/* Step 5 */}
          {currentStep === 5 && (
            <div className="space-y-5">
              <h2 className="text-xl">Budget</h2>
              <div>
                <FieldLabel optional>Suggested ranges</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {BUDGET_RANGES.map((r) => (
                    <button key={r.label} type="button"
                      onClick={() => { update("budgetMin", String(r.min)); update("budgetMax", r.max ? String(r.max) : ""); update("budgetNotSure", false); update("letArtistsQuote", false); }}
                      className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all ${
                        form.budgetMin === String(r.min) && form.budgetMax === (r.max ? String(r.max) : "") ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]" : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)]"
                      }`}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Minimum budget (₹)" optional value={form.budgetMin} onChange={(e) => update("budgetMin", e.target.value)} disabled={form.budgetNotSure || form.letArtistsQuote} />
                <Input label="Maximum budget (₹)" optional value={form.budgetMax} onChange={(e) => update("budgetMax", e.target.value)} disabled={form.budgetNotSure || form.letArtistsQuote} />
              </div>
              <label className="flex items-center gap-2.5 text-sm text-[var(--color-text)]">
                <input type="checkbox" checked={form.budgetNegotiable} onChange={(e) => update("budgetNegotiable", e.target.checked)} className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)]" />
                Negotiable
              </label>
              <label className="flex items-center gap-2.5 text-sm text-[var(--color-text)]">
                <input type="checkbox" checked={form.letArtistsQuote} onChange={(e) => update("letArtistsQuote", e.target.checked)} className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)]" />
                Let artists quote
              </label>
              <label className="flex items-center gap-2.5 text-sm text-[var(--color-text)]">
                <input type="checkbox" checked={form.budgetNotSure} onChange={(e) => update("budgetNotSure", e.target.checked)} className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)]" />
                Not sure yet
              </label>
            </div>
          )}

          {/* Step 6 */}
          {currentStep === 6 && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl">Additional preferences</h2>
                <div className="mt-5 space-y-5">
                  <div>
                    <FieldLabel optional>Languages</FieldLabel>
                    <MultiChip options={LANGUAGES} selected={form.preferredLanguages} onChange={(v) => update("preferredLanguages", v)} />
                  </div>
                  <TagInput label="Specializations" hint="Optional" values={form.specializations} onChange={(v) => update("specializations", v)} />
                  <TagInput label="Style or genre" hint="Optional" values={form.genres} onChange={(v) => update("genres", v)} />
                  <div>
                    <FieldLabel optional>Solo artist or group</FieldLabel>
                    <ToggleGroup options={GROUP_TYPE_OPTIONS} value={form.groupTypePreference} onChange={(v) => update("groupTypePreference", v)} />
                  </div>
                  <Select label="Experience preference" optional value={form.experiencePreference} onChange={(e) => update("experiencePreference", e.target.value)}>
                    <option value="">No preference</option>
                    {EXPERIENCE_PREFERENCES.map((o) => <option key={o} value={o}>{o}</option>)}
                  </Select>
                  <Textarea label="Equipment requirements" optional value={form.equipmentRequirements} onChange={(e) => update("equipmentRequirements", e.target.value)} rows={3} />
                  <Textarea label="Additional notes" optional value={form.additionalNotes} onChange={(e) => update("additionalNotes", e.target.value)} rows={3} />
                </div>
              </div>

              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-[var(--color-text)]">Review your preferences</h2>
                  <button type="button" onClick={() => setCurrentStep(1)} className="text-sm font-semibold text-[var(--color-accent)]">Edit</button>
                </div>
                <dl className="space-y-3 text-sm">
                  {[
                    ["Artist type", form.artistCategories.join(", ") || "—"],
                    ["Event type", form.eventTypes.join(", ") || "—"],
                    ["Location", summaryLocation || "—"],
                    ["Date", form.dateNotDecided ? "Not decided" : form.eventDate || "—"],
                    ["Budget", summaryBudget || "—"],
                    ["Languages", form.preferredLanguages.join(", ") || "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <dt className="text-[var(--color-text-secondary)]">{label}</dt>
                      <dd className="font-medium text-[var(--color-text)] text-right">{value}</dd>
                    </div>
                  ))}
                </dl>
                {(form.artistCategories.length > 0 || form.eventTypes.length > 0) && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {form.artistCategories.map((c) => <Badge key={c} variant="accent" className="normal-case tracking-normal">{c}</Badge>)}
                    {form.eventTypes.map((e) => <Badge key={e} variant="secondary" className="normal-case tracking-normal">{e}</Badge>)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-4 pt-8 mt-8 border-t border-[var(--color-border)]">
          <Button type="button" variant="ghost" size="md" onClick={handleBack} disabled={currentStep === 1}>Back</Button>
          <div className="flex flex-wrap items-center gap-3">
            {currentStep < STEP_LABELS.length ? (
              <Button type="button" variant="primary" size="md" onClick={handleContinue}>Continue</Button>
            ) : (
              <>
                <Button type="button" variant="outline" size="md" onClick={handleSavePreferences} disabled={saving}>
                  {saving ? "Saving…" : "Save Preferences"}
                </Button>
                <Button type="button" variant="primary" size="md" onClick={handleShowMatchingArtists} disabled={saving}>
                  Show Matching Artists
                </Button>
              </>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}
