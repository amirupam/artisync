import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase, ARTIST_MEDIA_BUCKET } from "@/lib/supabaseClient";
import { getArtistProfileCompleteness } from "@/lib/artistProfileCompleteness";
import { stripOAuthHashIfPresent } from "@/lib/stripOAuthHash";
import { geocodeLocation } from "@/lib/geocode";
import { ART_FORMS, EVENT_TYPES, LANGUAGES, INDIA_STATES } from "@/lib/sharedConfig";
import ArtistOnboardingCard from "@/components/ArtistOnboardingCard";
import NoIndexMeta from "@/components/NoIndexMeta";
import LoadingSpinner from "@/components/LoadingSpinner";
import StepIndicator from "@/components/StepIndicator";
import Container from "@/components/Container";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Textarea from "@/components/Textarea";
import Select from "@/components/Select";
import TagInput from "@/components/TagInput";
import Logo from "@/components/Logo";
import DashboardLink from "@/components/DashboardLink";

const ONBOARDING_DISMISS_KEY = "artisync_artist_onboarding_dismissed";

// ─── Configuration values specific to this wizard (shared vocab lives in lib/sharedConfig.ts) ──

const EXPERIENCE_OPTIONS = ["Less than 1 year","1–2 years","3–5 years","6–10 years","More than 10 years"];
const BOOKING_TYPES = ["Full Event","Half Day","Per Session","Per Song / Set","Consultation Only"];
const AVAILABILITY_STATUSES = ["Available now","Limited availability","Not currently available"];
const WORK_MODES = ["Online", "Offline", "Either"];
const PRICING_UNITS = ["Per Event", "Per Hour", "Per Day", "Per Song / Set"];
const CONTACT_METHODS = ["Phone", "Email", "WhatsApp", "Instagram", "Facebook"];
const TRAVEL_PREFERENCES = ["Local city only", "Within state", "Anywhere in India", "International"];
const SKILL_SUGGESTIONS = ["Live performance","Studio recording","Choreography","Teaching / Workshops","Event hosting","Improvisation","Composition","Sound design"];
const GENRE_SUGGESTIONS = ["Classical","Folk","Bollywood","Pop","Rock","Jazz","Fusion","Devotional","Contemporary","Hip Hop"];
const INSTRUMENT_SUGGESTIONS = ["Guitar","Piano","Tabla","Violin","Flute","Drums","Sitar","Harmonium","Saxophone","Cajon"];

const STEP_LABELS = ["Basic Info", "Art & Skills", "Portfolio", "Availability & Pricing", "Contact & Review"];

// ─── Helpers ────────────────────────────────────────────────────────────────

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function MultiChip({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button key={opt} type="button"
          onClick={() => onChange(selected.includes(opt) ? selected.filter((x) => x !== opt) : [...selected, opt])}
          className={`min-h-[38px] px-3 py-1.5 rounded-full text-sm font-medium border transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${
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
  return (
    <p className="text-sm font-medium text-[var(--color-text)] mb-2">
      {children} {optional && <span className="text-[var(--color-text-secondary)] font-normal">(optional)</span>}
    </p>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

type FormState = {
  fullName: string; stageName: string; headline: string;
  profilePicture: File | null; profilePictureUrl: string;
  coverBanner: File | null; coverBannerUrl: string; coverBannerPositionY: number;
  artForm: string; artSubForms: string[]; skills: string[]; genres: string[]; instruments: string[]; groupType: string;
  bio: string;
  state: string; city: string; area: string; country: string; travelPreference: string;
  youtubeVideos: string[]; youtubeVideoCaptions: string[];
  performanceImageUrls: string[]; performanceImageCaptions: string[];
  experience: string; languages: string[]; eventTypes: string[];
  availabilityStatus: string; workMode: string; bookingTypes: string[];
  priceRange: string; pricingUnit: string; priceNegotiable: boolean; travelAvailable: boolean; eventDuration: string; equipmentInfo: string;
  phone: string; email: string; preferredContactMethod: string; instagram: string; facebook: string; youtube: string; website: string;
  status: "draft" | "published";
};

const EMPTY_FORM: FormState = {
  fullName: "", stageName: "", headline: "",
  profilePicture: null, profilePictureUrl: "",
  coverBanner: null, coverBannerUrl: "", coverBannerPositionY: 50,
  artForm: "", artSubForms: [], skills: [], genres: [], instruments: [], groupType: "",
  bio: "",
  state: "", city: "", area: "", country: "India", travelPreference: "",
  youtubeVideos: [""], youtubeVideoCaptions: [""],
  performanceImageUrls: [], performanceImageCaptions: [],
  experience: "", languages: [], eventTypes: [],
  availabilityStatus: "", workMode: "", bookingTypes: [],
  priceRange: "", pricingUnit: "", priceNegotiable: false, travelAvailable: false, eventDuration: "", equipmentInfo: "",
  phone: "", email: "", preferredContactMethod: "", instagram: "", facebook: "", youtube: "", website: "",
  status: "draft",
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CreateProfilePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [furthestStep, setFurthestStep] = useState(1);
  const [dirty, setDirty] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [newPerformanceFiles, setNewPerformanceFiles] = useState<File[]>([]);
  const [performancePreviews, setPerformancePreviews] = useState<string[]>([]);
  const [newPerformanceCaptions, setNewPerformanceCaptions] = useState<string[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const perfInputRef = useRef<HTMLInputElement>(null);
  const geocodedRef = useRef<{ query: string; lat: number | null; lng: number | null }>({ query: "", lat: null, lng: null });

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [customSpecialization, setCustomSpecialization] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationCaptured, setLocationCaptured] = useState(false);
  const [profilePhotoLightbox, setProfilePhotoLightbox] = useState(false);
  const [coverDragOver, setCoverDragOver] = useState(false);
  const [profileDragOver, setProfileDragOver] = useState(false);
  const coverDragState = useRef<{ startY: number; startPos: number } | null>(null);

  // ── Load session + existing profile ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let initialized = false;

    async function handleUser(u: { id: string; email?: string | null } | null | undefined) {
      if (cancelled) return;
      if (!u) { router.replace({ pathname: "/signup", query: { role: "artist" } }); return; }
      initialized = true;
      stripOAuthHashIfPresent();
      setUserId(u.id);
      setForm((p) => ({ ...p, email: u.email ?? p.email }));
      try {
        const { data: d } = await supabase.from("artists").select("*").eq("id", u.id).maybeSingle();
        if (cancelled) return;
        if (d) {
          const loaded: FormState = {
            ...EMPTY_FORM,
            fullName: d.full_name ?? "", stageName: d.stage_name ?? "", headline: d.headline ?? "",
            profilePictureUrl: d.profile_picture_url ?? "", coverBannerUrl: d.cover_banner_url ?? "",
            coverBannerPositionY: typeof d.cover_banner_position_y === "number" ? d.cover_banner_position_y : 50,
            artForm: d.art_form ?? "", artSubForms: d.art_sub_forms ?? [], skills: d.skills ?? [], genres: d.genres ?? [], instruments: d.instruments ?? [], groupType: d.group_type ?? "",
            bio: d.bio ?? "",
            state: d.state ?? "", city: d.city ?? "", area: d.area ?? "", country: d.country ?? "India", travelPreference: d.travel_preference ?? "",
            youtubeVideos: d.youtube_videos?.length ? d.youtube_videos : [""],
            youtubeVideoCaptions: (() => {
              const vids: string[] = d.youtube_videos?.length ? d.youtube_videos : [""];
              const caps: string[] = d.youtube_video_captions ?? [];
              return vids.map((_: string, i: number) => caps[i] ?? "");
            })(),
            performanceImageUrls: d.performance_image_urls ?? [],
            performanceImageCaptions: d.performance_image_captions ?? [],
            experience: d.experience ?? "", languages: d.languages ?? [], eventTypes: d.event_types ?? [],
            availabilityStatus: d.availability_status ?? "", workMode: d.work_mode ?? "", bookingTypes: d.booking_types ?? [],
            priceRange: d.price_range ?? "", pricingUnit: d.pricing_unit ?? "", priceNegotiable: d.price_negotiable ?? false,
            travelAvailable: d.travel_available ?? false, eventDuration: d.event_duration ?? "", equipmentInfo: d.equipment_info ?? "",
            phone: d.phone ?? "", email: d.email ?? u.email ?? "", preferredContactMethod: d.preferred_contact_method ?? "",
            instagram: d.instagram ?? "", facebook: d.facebook ?? "", youtube: d.youtube ?? "", website: d.website ?? "",
            status: d.status === "published" ? "published" : "draft",
          };
          setForm(loaded);
          const loadedSubForms = ART_FORMS[loaded.artForm] ?? [];
          const existingCustomSpecialization = loaded.artSubForms.find((v) => !loadedSubForms.includes(v));
          if (existingCustomSpecialization) setCustomSpecialization(existingCustomSpecialization);
          geocodedRef.current = {
            query: [loaded.area, loaded.city, loaded.state, "India"].filter(Boolean).join(", "),
            lat: typeof d.latitude === "number" ? d.latitude : null,
            lng: typeof d.longitude === "number" ? d.longitude : null,
          };
          setLocationCaptured(geocodedRef.current.lat != null && geocodedRef.current.lng != null);
          setProfileSaved(true);
          const { nextIncompleteSection } = getArtistProfileCompleteness(loaded);
          const requestedStep = Number(router.query.step);
          const startStep = requestedStep >= 1 && requestedStep <= STEP_LABELS.length ? requestedStep : (nextIncompleteSection ?? 1);
          setCurrentStep(startStep);
          setFurthestStep((f) => Math.max(f, startStep));
        } else if (sessionStorage.getItem(ONBOARDING_DISMISS_KEY) !== "1") {
          setShowOnboarding(true);
        }
      } catch {} finally {
        if (!cancelled) setCheckingProfile(false);
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => handleUser(session?.user));
    // Once the profile has loaded, ignore further auth events (token
    // refresh fires periodically and whenever the tab regains focus) —
    // reprocessing them reloaded the form from the database and reset the
    // wizard to whatever step/selections were last saved, silently
    // discarding in-progress edits (unsaved chip selections, the step you
    // were on, etc). Only a genuine sign-out still needs to redirect away.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") { handleUser(null); return; }
      if (initialized || event === "INITIAL_SESSION") return;
      handleUser(session?.user);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [router]);

  // ── Warn before leaving with unsaved changes ──────────────────────────────
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);

    function onRouteChangeStart() {
      if (!dirty) return;
      const ok = window.confirm("You have unsaved changes. Leave this page anyway?");
      if (!ok) {
        router.events.emit("routeChangeError");
        throw new Error("Route change aborted by user (unsaved changes).");
      }
    }
    router.events.on("routeChangeStart", onRouteChangeStart);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      router.events.off("routeChangeStart", onRouteChangeStart);
    };
  }, [dirty, router.events]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  // ── Upload helper (unchanged logic/paths) ─────────────────────────────────
  async function uploadFile(file: File, path: string): Promise<string> {
    const { error: uploadError } = await supabase.storage.from(ARTIST_MEDIA_BUCKET).upload(path, file, { upsert: true });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from(ARTIST_MEDIA_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  function handlePerfImagesAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = 12 - form.performanceImageUrls.length - newPerformanceFiles.length;
    const toAdd = files.slice(0, remaining);
    setNewPerformanceFiles((p) => [...p, ...toAdd]);
    setPerformancePreviews((p) => [...p, ...toAdd.map((f) => URL.createObjectURL(f))]);
    setNewPerformanceCaptions((p) => [...p, ...toAdd.map(() => "")]);
    setDirty(true);
    e.target.value = "";
  }

  function removeExistingImage(idx: number) {
    update("performanceImageUrls", form.performanceImageUrls.filter((_, i) => i !== idx));
    update("performanceImageCaptions", form.performanceImageCaptions.filter((_, i) => i !== idx));
  }

  function moveExistingImage(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= form.performanceImageUrls.length) return;
    const urls = [...form.performanceImageUrls];
    const caps = [...form.performanceImageCaptions];
    [urls[idx], urls[target]] = [urls[target], urls[idx]];
    [caps[idx], caps[target]] = [caps[target], caps[idx]];
    update("performanceImageUrls", urls);
    update("performanceImageCaptions", caps);
  }

  function removeNewImage(idx: number) {
    URL.revokeObjectURL(performancePreviews[idx]);
    setNewPerformanceFiles((p) => p.filter((_, i) => i !== idx));
    setPerformancePreviews((p) => p.filter((_, i) => i !== idx));
    setNewPerformanceCaptions((p) => p.filter((_, i) => i !== idx));
  }

  // ── Validation (only the current step) ────────────────────────────────────
  function validateStep(step: number): boolean {
    const errs: Record<string, string> = {};
    if (step === 1 && !form.fullName.trim()) errs.fullName = "Your name is required.";
    if (step === 5) {
      if (!form.phone.trim()) errs.phone = "Phone number is required.";
      if (!form.email.trim()) errs.email = "Email address is required.";
    }
    setStepErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Save (draft or publish) ────────────────────────────────────────────────
  async function saveProgress(opts: { publish?: boolean; silent?: boolean } = {}): Promise<boolean> {
    if (!userId) return false;
    setLoading(true); setError(null); if (!opts.silent) setSuccessMessage(null);
    try {
      let profilePictureUrl = form.profilePictureUrl;
      let coverBannerUrl = form.coverBannerUrl;
      if (form.profilePicture) {
        setUploadingMedia(true);
        profilePictureUrl = await uploadFile(form.profilePicture, `${userId}/profile_${Date.now()}.${form.profilePicture.name.split(".").pop()}`);
      }
      if (form.coverBanner) {
        setUploadingMedia(true);
        coverBannerUrl = await uploadFile(form.coverBanner, `${userId}/banner_${Date.now()}.${form.coverBanner.name.split(".").pop()}`);
      }

      const newImageUrls = await Promise.all(
        newPerformanceFiles.map((f, i) => {
          setUploadingMedia(true);
          return uploadFile(f, `${userId}/perf_${Date.now()}_${i}.${f.name.split(".").pop()}`);
        })
      );
      setUploadingMedia(false);
      const allPerformanceUrls = [...form.performanceImageUrls, ...newImageUrls];
      const allPerformanceCaptions = [...form.performanceImageCaptions, ...newPerformanceCaptions];

      const filteredVideos = form.youtubeVideos.filter((v) => v.trim());
      const filteredVideoCaptions = form.youtubeVideos
        .map((v, i) => ({ keep: !!v.trim(), cap: form.youtubeVideoCaptions[i] ?? "" }))
        .filter((x) => x.keep)
        .map((x) => x.cap);

      const nextStatus: "draft" | "published" = opts.publish ? "published" : form.status;

      // Geocode the artist's own city/locality (never a street address) so
      // distance-based search can work — only re-geocode if it changed.
      const locationQuery = [form.area, form.city, form.state, "India"].filter(Boolean).join(", ");
      if (locationQuery && locationQuery !== geocodedRef.current.query) {
        const coords = await geocodeLocation(locationQuery);
        geocodedRef.current = { query: locationQuery, lat: coords?.lat ?? null, lng: coords?.lng ?? null };
      } else if (!locationQuery) {
        geocodedRef.current = { query: "", lat: null, lng: null };
      }

      const { error: dbError } = await supabase.from("artists").upsert({
        id: userId,
        full_name: form.fullName, stage_name: form.stageName, headline: form.headline,
        profile_picture_url: profilePictureUrl, cover_banner_url: coverBannerUrl, cover_banner_position_y: form.coverBannerPositionY,
        art_form: form.artForm, art_sub_forms: form.artSubForms, skills: form.skills, genres: form.genres, instruments: form.instruments, group_type: form.groupType,
        bio: form.bio,
        state: form.state, city: form.city, area: form.area, country: form.country, travel_preference: form.travelPreference,
        latitude: geocodedRef.current.lat, longitude: geocodedRef.current.lng,
        youtube_videos: filteredVideos,
        youtube_video_captions: filteredVideoCaptions,
        performance_image_urls: allPerformanceUrls,
        performance_image_captions: allPerformanceCaptions,
        experience: form.experience, languages: form.languages, event_types: form.eventTypes,
        availability_status: form.availabilityStatus, work_mode: form.workMode, booking_types: form.bookingTypes,
        price_range: form.priceRange, pricing_unit: form.pricingUnit, price_negotiable: form.priceNegotiable,
        travel_available: form.travelAvailable, event_duration: form.eventDuration, equipment_info: form.equipmentInfo,
        phone: form.phone, email: form.email, preferred_contact_method: form.preferredContactMethod,
        instagram: form.instagram, facebook: form.facebook, youtube: form.youtube, website: form.website,
        status: nextStatus,
      });
      if (dbError) throw dbError;

      setForm((p) => ({ ...p, profilePicture: null, coverBanner: null, profilePictureUrl, coverBannerUrl, performanceImageUrls: allPerformanceUrls, performanceImageCaptions: allPerformanceCaptions, status: nextStatus }));
      setNewPerformanceFiles([]); setPerformancePreviews([]); setNewPerformanceCaptions([]);
      setProfileSaved(true); setDirty(false);
      if (!opts.silent) setSuccessMessage(opts.publish ? "Profile published! Clients can now discover you." : "Draft saved.");
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
      return false;
    } finally {
      setLoading(false);
      setUploadingMedia(false);
    }
  }

  async function handleContinue() {
    if (!validateStep(currentStep)) return;
    const ok = await saveProgress({ silent: true });
    if (!ok) return;
    const next = Math.min(currentStep + 1, STEP_LABELS.length);
    setCurrentStep(next);
    setFurthestStep((f) => Math.max(f, next));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBack() {
    setCurrentStep((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSaveDraft() {
    await saveProgress({ silent: false });
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    if (!validateStep(5)) return;
    const completeness = getArtistProfileCompleteness(form);
    if (!completeness.publishable) {
      setError(`Complete these before publishing: ${completeness.missingFields.join(", ")}`);
      if (completeness.nextIncompleteSection) setCurrentStep(completeness.nextIncompleteSection);
      return;
    }
    await saveProgress({ publish: true });
  }

  function handleCompleteOnboarding() {
    setShowOnboarding(false);
    setCurrentStep(1);
  }

  function handleOnboardingLater() {
    sessionStorage.setItem(ONBOARDING_DISMISS_KEY, "1");
    setShowOnboarding(false);
  }

  const subForms = ART_FORMS[form.artForm] ?? [];
  const stateCities = form.state ? (INDIA_STATES[form.state] ?? []) : [];
  const allPerformancePreviews = [...form.performanceImageUrls, ...performancePreviews];
  const totalImages = allPerformancePreviews.length;
  const completeness = getArtistProfileCompleteness(form);

  if (checkingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-page)]">
        <NoIndexMeta />
        <LoadingSpinner size="lg" label="Loading your profile" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-page)] pb-20">
      <NoIndexMeta />
      <ArtistOnboardingCard open={showOnboarding} onComplete={handleCompleteOnboarding} onLater={handleOnboardingLater} />

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur">
        <Container className="flex h-16 items-center justify-between gap-4">
          <Logo size="sm" />
          <div className="hidden sm:block flex-1 max-w-xs">
            <div className="h-2 w-full rounded-full bg-[var(--color-primary-soft)] overflow-hidden">
              <div className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500" style={{ width: `${completeness.percentage}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DashboardLink />
            {profileSaved ? (
              <Button href="/profile-preview" variant="ghost" size="sm">Preview</Button>
            ) : (
              <Button type="button" variant="ghost" size="sm" disabled>Preview</Button>
            )}
          </div>
        </Container>
      </header>

      <Container className="pt-8">
        <StepIndicator steps={STEP_LABELS} currentStep={currentStep} furthestStep={furthestStep} onStepClick={(s) => setCurrentStep(s)} />
      </Container>

      <Container className="pt-8 max-w-3xl">
        {error && (
          <p className="mb-6 rounded-[var(--radius-md)] bg-[var(--color-error-soft)] px-4 py-3 text-sm text-[var(--color-error)]" role="alert">
            {error}
          </p>
        )}
        {successMessage && (
          <p className="mb-6 rounded-[var(--radius-md)] bg-[var(--color-success-soft)] px-4 py-3 text-sm text-[var(--color-success)]" role="status">
            {successMessage}
          </p>
        )}

        <form onSubmit={handlePublish} className="space-y-8">
          {/* ═══ STEP 1 — Basic information ═══ */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl">Basic information</h1>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Tell clients who you are.</p>
              </div>

              <div>
                <FieldLabel>Profile photograph</FieldLabel>
                <div className="flex items-center gap-4">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setProfileDragOver(true); }}
                    onDragLeave={() => setProfileDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setProfileDragOver(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f && f.type.startsWith("image/")) update("profilePicture", f);
                    }}
                    className={`relative w-20 h-20 rounded-full border-2 bg-[var(--color-surface)] overflow-hidden flex-shrink-0 transition-colors ${
                      profileDragOver ? "border-[var(--color-accent)] border-dashed" : "border-[var(--color-border)]"
                    }`}
                  >
                    {(form.profilePicture || form.profilePictureUrl) ? (
                      <button
                        type="button"
                        onClick={() => setProfilePhotoLightbox(true)}
                        className="w-full h-full block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                        aria-label="View full profile photo"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={form.profilePicture ? URL.createObjectURL(form.profilePicture) : form.profilePictureUrl} alt="Profile" className="w-full h-full object-cover" />
                      </button>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[var(--color-text-secondary)]">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div>
                    <input type="file" accept="image/*" id="pic-input" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) update("profilePicture", f); }} />
                    <label htmlFor="pic-input">
                      <span className="inline-flex cursor-pointer items-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-sm font-semibold hover:bg-[var(--color-primary-soft)]">
                        {form.profilePicture || form.profilePictureUrl ? "Change photo" : "Upload photo"}
                      </span>
                    </label>
                    <p className="mt-1.5 text-xs text-[var(--color-text-secondary)]">JPG or PNG, up to 5MB. Drag and drop onto the circle, or click it to view full size.</p>
                  </div>
                </div>
              </div>

              {profilePhotoLightbox && (form.profilePicture || form.profilePictureUrl) && (
                <div className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4" onClick={() => setProfilePhotoLightbox(false)}>
                  <button type="button" onClick={() => setProfilePhotoLightbox(false)} aria-label="Close" className="absolute top-4 right-4 text-white/80 hover:text-white">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.profilePicture ? URL.createObjectURL(form.profilePicture) : form.profilePictureUrl}
                    alt="Profile"
                    className="max-h-[85vh] max-w-full rounded-[var(--radius-md)] object-contain"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}

              <Input label="Artist name" required value={form.fullName} onChange={(e) => update("fullName", e.target.value)} error={stepErrors.fullName} />
              <Input label="Stage name" optional hint="If different from your artist name." value={form.stageName} onChange={(e) => update("stageName", e.target.value)} />
              <Input label="Professional headline" hint='e.g. "Bollywood playback singer for weddings & events"' value={form.headline} onChange={(e) => update("headline", e.target.value)} />

              <Textarea
                label="Biography"
                value={form.bio}
                onChange={(e) => update("bio", e.target.value)}
                hint="Describe your style, experience, and what makes you unique."
                rows={5}
              />

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
              <Input label="Locality / Area" hint="e.g. Bandra, Koramangala, Salt Lake…" value={form.area} onChange={(e) => update("area", e.target.value)} />

              <div>
                <button
                  type="button"
                  disabled={locating}
                  onClick={() => {
                    if (!navigator.geolocation) return;
                    setLocating(true);
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        const locationQuery = [form.area, form.city, form.state, "India"].filter(Boolean).join(", ");
                        geocodedRef.current = { query: locationQuery, lat: pos.coords.latitude, lng: pos.coords.longitude };
                        setLocationCaptured(true);
                        setLocating(false);
                      },
                      () => setLocating(false),
                      { timeout: 10000 }
                    );
                  }}
                  className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-primary-soft)] disabled:opacity-60"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                  {locating ? "Locating…" : locationCaptured ? "Update my approximate location" : "Use my approximate location"}
                </button>
                {locationCaptured && (
                  <p className="mt-1.5 text-xs text-[var(--color-success)]">✓ Location captured — this is what lets clients see distance to you.</p>
                )}
                <p className="mt-1.5 text-xs text-[var(--color-text-secondary)]">We only use this to show clients an approximate distance — never your exact address.</p>
              </div>
              <Select label="Travel location preference" value={form.travelPreference} onChange={(e) => update("travelPreference", e.target.value)}>
                <option value="">Select preference</option>
                {TRAVEL_PREFERENCES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </div>
          )}

          {/* ═══ STEP 2 — Art and skills ═══ */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl">Art and skills</h1>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">What do you do, and how would you describe it?</p>
              </div>

              <div>
                <FieldLabel>Primary art form</FieldLabel>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {Object.keys(ART_FORMS).map((af) => (
                    <button key={af} type="button" onClick={() => { update("artForm", af); update("artSubForms", []); setCustomSpecialization(""); }}
                      className={`min-h-[44px] px-2 rounded-[var(--radius-md)] text-sm font-medium border text-center transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${
                        form.artForm === af ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]" : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary)]"
                      }`}>
                      {af}
                    </button>
                  ))}
                </div>
              </div>

              {subForms.length > 0 && (() => {
                const chipOptions = [...subForms, "Other"];
                const chipSelected = [
                  ...form.artSubForms.filter((v) => subForms.includes(v)),
                  ...(form.artSubForms.some((v) => !subForms.includes(v)) ? ["Other"] : []),
                ];
                return (
                  <div>
                    <FieldLabel optional>Specializations</FieldLabel>
                    <MultiChip
                      options={chipOptions}
                      selected={chipSelected}
                      onChange={(next) => {
                        const canonical = next.filter((v) => v !== "Other");
                        if (next.includes("Other")) {
                          update("artSubForms", customSpecialization.trim() ? [...canonical, customSpecialization.trim()] : canonical);
                        } else {
                          setCustomSpecialization("");
                          update("artSubForms", canonical);
                        }
                      }}
                    />
                    {chipSelected.includes("Other") && (
                      <Input
                        className="mt-2"
                        placeholder="Type your specialization"
                        value={customSpecialization}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomSpecialization(val);
                          const canonical = form.artSubForms.filter((v) => subForms.includes(v));
                          update("artSubForms", val.trim() ? [...canonical, val.trim()] : canonical);
                        }}
                      />
                    )}
                  </div>
                );
              })()}

              <TagInput label="Skills" hint="Add your own, or pick a suggestion." suggestions={SKILL_SUGGESTIONS} values={form.skills} onChange={(v) => update("skills", v)} />
              <TagInput label="Style or genre" suggestions={GENRE_SUGGESTIONS} values={form.genres} onChange={(v) => update("genres", v)} />
              <TagInput label="Instruments" suggestions={INSTRUMENT_SUGGESTIONS} values={form.instruments} onChange={(v) => update("instruments", v)} />

              <div>
                <FieldLabel>Languages you perform in</FieldLabel>
                <MultiChip options={LANGUAGES} selected={form.languages} onChange={(v) => update("languages", v)} />
              </div>
              <div>
                <FieldLabel>Events you perform at</FieldLabel>
                <MultiChip options={EVENT_TYPES} selected={form.eventTypes} onChange={(v) => update("eventTypes", v)} />
              </div>
              <div>
                <FieldLabel>Solo artist or group</FieldLabel>
                <ToggleGroup options={["Solo", "Group"]} value={form.groupType} onChange={(v) => update("groupType", v)} />
              </div>
            </div>
          )}

          {/* ═══ STEP 3 — Portfolio ═══ */}
          {currentStep === 3 && (
            <div className="space-y-8">
              <div>
                <h1 className="text-2xl">Portfolio</h1>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Show clients your best work.</p>
              </div>

              <div>
                <FieldLabel>Cover photo</FieldLabel>
                <div
                  onDragOver={(e) => { e.preventDefault(); setCoverDragOver(true); }}
                  onDragLeave={() => setCoverDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setCoverDragOver(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f && f.type.startsWith("image/")) update("coverBanner", f);
                  }}
                  onPointerDown={(e) => {
                    if (!(form.coverBanner || form.coverBannerUrl)) return;
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    coverDragState.current = { startY: e.clientY, startPos: form.coverBannerPositionY };
                  }}
                  onPointerMove={(e) => {
                    if (!coverDragState.current) return;
                    const deltaY = e.clientY - coverDragState.current.startY;
                    const containerHeight = e.currentTarget.clientHeight || 1;
                    const deltaPercent = (deltaY / containerHeight) * 100;
                    const next = Math.min(100, Math.max(0, coverDragState.current.startPos - deltaPercent));
                    update("coverBannerPositionY", next);
                  }}
                  onPointerUp={() => { coverDragState.current = null; }}
                  className={`relative h-56 sm:h-64 rounded-[var(--radius-lg)] overflow-hidden bg-[var(--color-primary-soft)] border-2 transition-colors ${
                    coverDragOver ? "border-[var(--color-accent)] border-dashed" : "border-transparent"
                  } ${form.coverBanner || form.coverBannerUrl ? "cursor-move" : ""}`}
                >
                  {(form.coverBanner || form.coverBannerUrl) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.coverBanner ? URL.createObjectURL(form.coverBanner) : form.coverBannerUrl}
                      alt="Cover"
                      draggable={false}
                      className="w-full h-full object-cover pointer-events-none select-none"
                      style={{ objectPosition: `center ${form.coverBannerPositionY}%` }}
                    />
                  )}
                  <input type="file" accept="image/*" id="cover-input" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) update("coverBanner", f); }} />
                  <label htmlFor="cover-input" className="absolute bottom-3 right-3 cursor-pointer rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/75">
                    {form.coverBanner || form.coverBannerUrl ? "Change cover" : "+ Add cover photo"}
                  </label>
                  {(form.coverBanner || form.coverBannerUrl) && (
                    <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white">
                      Drag to reposition
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-[var(--color-text-secondary)]">Drag and drop an image here, or drag the photo itself up/down to adjust what&apos;s visible.</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <FieldLabel optional>Performance photographs</FieldLabel>
                  <span className="text-xs text-[var(--color-text-secondary)]">{totalImages}/12</span>
                </div>
                <p className="mb-3 text-xs text-[var(--color-text-secondary)]">JPG or PNG, up to 5MB each. Drag order with the arrows.</p>
                <input ref={perfInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePerfImagesAdd} />

                {totalImages === 0 ? (
                  <button type="button" onClick={() => perfInputRef.current?.click()}
                    className="w-full rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-accent)] py-12 flex flex-col items-center justify-center gap-2 text-[var(--color-text-secondary)] transition-colors">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-sm font-medium">No photos yet — add your first one</span>
                  </button>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {form.performanceImageUrls.map((url, i) => (
                      <div key={`saved-${url}`} className="flex flex-col gap-1.5 group">
                        <div className="relative aspect-square rounded-[var(--radius-md)] overflow-hidden bg-[var(--color-primary-soft)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => removeExistingImage(i)}
                            className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                          <div className="absolute bottom-1 left-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button type="button" disabled={i === 0} onClick={() => moveExistingImage(i, -1)} className="w-6 h-6 bg-black/60 disabled:opacity-30 text-white rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            <button type="button" disabled={i === form.performanceImageUrls.length - 1} onClick={() => moveExistingImage(i, 1)} className="w-6 h-6 bg-black/60 disabled:opacity-30 text-white rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </button>
                          </div>
                        </div>
                        <input type="text" placeholder="Caption (optional)" value={form.performanceImageCaptions[i] ?? ""}
                          onChange={(e) => { const caps = [...form.performanceImageCaptions]; caps[i] = e.target.value; update("performanceImageCaptions", caps); }}
                          className="w-full text-xs bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] px-2 py-1.5" />
                      </div>
                    ))}
                    {performancePreviews.map((src, i) => (
                      <div key={`new-${i}`} className="flex flex-col gap-1.5 group">
                        <div className="relative aspect-square rounded-[var(--radius-md)] overflow-hidden bg-[var(--color-primary-soft)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt="" className="w-full h-full object-cover" />
                          <span className="absolute bottom-1 left-1 text-[10px] text-white bg-blue-500/80 px-1.5 py-0.5 rounded">new</span>
                          <button type="button" onClick={() => removeNewImage(i)}
                            className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                        <input type="text" placeholder="Caption (optional)" value={newPerformanceCaptions[i] ?? ""}
                          onChange={(e) => { const caps = [...newPerformanceCaptions]; caps[i] = e.target.value; setNewPerformanceCaptions(caps); }}
                          className="w-full text-xs bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] px-2 py-1.5" />
                      </div>
                    ))}
                    {totalImages < 12 && (
                      <button type="button" onClick={() => perfInputRef.current?.click()}
                        className="aspect-square rounded-[var(--radius-md)] border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-accent)] flex flex-col items-center justify-center gap-1 text-[var(--color-text-secondary)] transition-all">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        <span className="text-[10px]">Add</span>
                      </button>
                    )}
                  </div>
                )}
                {uploadingMedia && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                    <LoadingSpinner size="sm" /> Uploading media…
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <FieldLabel optional>YouTube or video links</FieldLabel>
                  {form.youtubeVideos.length < 6 && (
                    <button type="button" onClick={() => { update("youtubeVideos", [...form.youtubeVideos, ""]); update("youtubeVideoCaptions", [...form.youtubeVideoCaptions, ""]); }}
                      className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
                      + Add video
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {form.youtubeVideos.map((url, i) => {
                    const vid = getYouTubeId(url);
                    return (
                      <div key={i} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-3">
                          <input type="url" placeholder={`Video ${i + 1} — paste YouTube link`} value={url}
                            onChange={(e) => { const v = [...form.youtubeVideos]; v[i] = e.target.value; update("youtubeVideos", v); }}
                            className="flex-1 text-sm bg-transparent border-none outline-none" />
                          {vid && <span className="text-xs text-[var(--color-success)] font-medium flex-shrink-0">✓ valid</span>}
                          {!vid && url && <span className="text-xs text-[var(--color-error)] flex-shrink-0">invalid</span>}
                          {form.youtubeVideos.length > 1 && (
                            <button type="button" onClick={() => { update("youtubeVideos", form.youtubeVideos.filter((_, j) => j !== i)); update("youtubeVideoCaptions", form.youtubeVideoCaptions.filter((_, j) => j !== i)); }}
                              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] flex-shrink-0">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          )}
                        </div>
                        <div className="px-4 pb-3 border-t border-[var(--color-border)] pt-2">
                          <input type="text" placeholder="Caption for this video (optional)" value={form.youtubeVideoCaptions[i] ?? ""}
                            onChange={(e) => { const v = [...form.youtubeVideoCaptions]; v[i] = e.target.value; update("youtubeVideoCaptions", v); }}
                            className="w-full text-xs bg-transparent border-none outline-none" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ═══ STEP 4 — Availability and pricing ═══ */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl">Availability and pricing</h1>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Help clients know if and how they can book you.</p>
              </div>

              <Select label="Availability status" value={form.availabilityStatus} onChange={(e) => update("availabilityStatus", e.target.value)}>
                <option value="">Select status</option>
                {AVAILABILITY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>

              <div>
                <FieldLabel>Online / offline</FieldLabel>
                <ToggleGroup options={WORK_MODES} value={form.workMode} onChange={(v) => update("workMode", v)} />
              </div>

              <div>
                <FieldLabel optional>Booking types</FieldLabel>
                <MultiChip options={BOOKING_TYPES} selected={form.bookingTypes} onChange={(v) => update("bookingTypes", v)} />
              </div>

              <Select label="Years of experience" value={form.experience} onChange={(e) => update("experience", e.target.value)}>
                <option value="">Select</option>
                {EXPERIENCE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </Select>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Starting price (₹)" hint="e.g. 5,000 or 5,000–15,000" value={form.priceRange} onChange={(e) => update("priceRange", e.target.value)} />
                <Select label="Pricing unit" value={form.pricingUnit} onChange={(e) => update("pricingUnit", e.target.value)}>
                  <option value="">Select unit</option>
                  {PRICING_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </Select>
              </div>

              <label className="flex items-center gap-2.5 text-sm text-[var(--color-text)]">
                <input type="checkbox" checked={form.priceNegotiable} onChange={(e) => update("priceNegotiable", e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]" />
                Price is negotiable
              </label>
              <label className="flex items-center gap-2.5 text-sm text-[var(--color-text)]">
                <input type="checkbox" checked={form.travelAvailable} onChange={(e) => update("travelAvailable", e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]" />
                Willing to travel for events
              </label>

              <Input label="Typical event duration" optional hint="e.g. 2 hours, half day, full day" value={form.eventDuration} onChange={(e) => update("eventDuration", e.target.value)} />
              <Textarea label="Equipment" optional hint="Any equipment you bring or require, if relevant." value={form.equipmentInfo} onChange={(e) => update("equipmentInfo", e.target.value)} rows={3} />
            </div>
          )}

          {/* ═══ STEP 5 — Contact and review ═══ */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl">Contact and review</h1>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">How should clients reach you?</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Phone number" type="tel" required value={form.phone} onChange={(e) => update("phone", e.target.value)} error={stepErrors.phone} />
                <Input label="Email address" type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} error={stepErrors.email} />
              </div>
              <Select label="Preferred contact method" value={form.preferredContactMethod} onChange={(e) => update("preferredContactMethod", e.target.value)}>
                <option value="">Select method</option>
                {CONTACT_METHODS.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
              <Input label="Website" optional type="url" value={form.website} onChange={(e) => update("website", e.target.value)} />
              <Input label="Instagram" optional type="url" value={form.instagram} onChange={(e) => update("instagram", e.target.value)} />
              <Input label="Facebook" optional type="url" value={form.facebook} onChange={(e) => update("facebook", e.target.value)} />
              <Input label="YouTube channel" optional type="url" value={form.youtube} onChange={(e) => update("youtube", e.target.value)} />

              {/* Review summary */}
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
                <h2 className="text-base font-semibold text-[var(--color-text)]">Profile completeness</h2>
                <div className="mt-3 h-2.5 w-full rounded-full bg-[var(--color-primary-soft)] overflow-hidden">
                  <div className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500" style={{ width: `${completeness.percentage}%` }} />
                </div>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{completeness.percentage}% complete</p>
                {!completeness.publishable && (
                  <div className="mt-3 rounded-[var(--radius-md)] bg-[var(--color-warning-soft)] px-4 py-3 text-sm text-[var(--color-warning)]">
                    Before publishing, add: {completeness.missingFields.join(", ")}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ Navigation ═══ */}
          <div className="flex items-center justify-between gap-4 pt-4 border-t border-[var(--color-border)]">
            <Button type="button" variant="ghost" size="md" onClick={handleBack} disabled={currentStep === 1}>
              Back
            </Button>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" size="md" onClick={handleSaveDraft} disabled={loading}>
                {loading ? "Saving…" : "Save Draft"}
              </Button>
              {currentStep < STEP_LABELS.length ? (
                <Button type="button" variant="primary" size="md" onClick={handleContinue} disabled={loading}>
                  Continue
                </Button>
              ) : (
                <Button type="submit" variant="primary" size="md" disabled={loading}>
                  {loading ? "Saving…" : form.status === "published" ? "Update Profile" : "Publish Profile"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </Container>
    </div>
  );
}
