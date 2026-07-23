import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase, mapArtistRow, type ArtistProfile } from "@/lib/supabaseClient";
import { getArtistProfileCompleteness } from "@/lib/artistProfileCompleteness";
import { stripOAuthHashIfPresent } from "@/lib/stripOAuthHash";
import { listOpenJobs, listMyApplications, applyToJob, uploadApplicationAttachment, formatBudget, formatJobLocation, type OpenJobListing, type ApplicationStatus } from "@/lib/jobs";
import Container from "@/components/Container";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Logo from "@/components/Logo";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import Modal from "@/components/Modal";
import Select from "@/components/Select";
import Input from "@/components/Input";
import Textarea from "@/components/Textarea";
import NoIndexMeta from "@/components/NoIndexMeta";
import { useChat } from "@/components/ChatContext";
import { useToast } from "@/components/Toast";
import ArtistNav from "@/components/ArtistNav";

function uniqueSorted(values: (string | undefined | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v && v.trim().length > 0))).sort();
}

type Action = { title: string; description: string; href: string; icon: React.ReactNode };

const APPLICATION_BADGE: Record<ApplicationStatus, "neutral" | "accent" | "success" | "error"> = {
  pending: "accent",
  accepted: "success",
  declined: "error",
};

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] ${className}`} />;
}

export default function DashboardPage() {
  const router = useRouter();
  const { openPanel } = useChat();
  const { showToast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ArtistProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const [jobs, setJobs] = useState<OpenJobListing[] | null>(null);
  const [applications, setApplications] = useState<Record<string, ApplicationStatus>>({});
  const [applyJob, setApplyJob] = useState<OpenJobListing | null>(null);
  const [applyMessage, setApplyMessage] = useState("");
  const [applyRate, setApplyRate] = useState("");
  const [applyLinks, setApplyLinks] = useState("");
  const [applyFile, setApplyFile] = useState<File | null>(null);
  const [applying, setApplying] = useState(false);

  const [jobCategory, setJobCategory] = useState("");
  const [jobState, setJobState] = useState("");
  const [jobCity, setJobCity] = useState("");
  const [jobEventType, setJobEventType] = useState("");

  const loadJobs = useCallback(async (artistId: string) => {
    const [{ data: openJobs }, { data: myApps }] = await Promise.all([listOpenJobs(), listMyApplications(artistId)]);
    setJobs((openJobs as OpenJobListing[]) ?? []);
    setApplications(Object.fromEntries(((myApps as { job_id: string; status: ApplicationStatus }[]) ?? []).map((a) => [a.job_id, a.status])));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function handleUser(u: { id: string } | null | undefined) {
      if (cancelled) return;
      if (!u) { router.replace({ pathname: "/signup", query: { role: "artist" } }); return; }
      stripOAuthHashIfPresent();
      setUserId(u.id);
      const { data: d } = await supabase.from("artists").select("*").eq("id", u.id).maybeSingle();
      if (cancelled) return;
      if (!d) { router.replace("/create-profile"); return; }
      setProfile(mapArtistRow(d));
      await loadJobs(u.id);
      if (cancelled) return;
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data: { session } }) => handleUser(session?.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      handleUser(session?.user);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [router, loadJobs]);

  async function togglePublishStatus() {
    if (!userId || !profile) return;
    setTogglingStatus(true);
    const nextStatus = profile.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("artists").update({ status: nextStatus }).eq("id", userId);
    if (!error) setProfile((p) => (p ? { ...p, status: nextStatus } : p));
    setTogglingStatus(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  async function submitApplication(e: React.FormEvent) {
    e.preventDefault();
    if (!applyJob || !userId) return;
    if (applyFile && applyFile.size > 25 * 1024 * 1024) {
      showToast("Attachments must be 25MB or smaller.", "error");
      return;
    }
    setApplying(true);
    let attachmentUrl: string | null = null;
    let attachmentType: string | null = null;
    if (applyFile) {
      const { path, error: uploadError } = await uploadApplicationAttachment(applyJob.id, userId, applyFile);
      if (uploadError) { showToast(uploadError.message, "error"); setApplying(false); return; }
      attachmentUrl = path;
      attachmentType = applyFile.type || "application/octet-stream";
    }
    const { error } = await applyToJob(applyJob.id, userId, {
      message: applyMessage,
      proposedRate: applyRate,
      links: applyLinks,
      attachmentUrl,
      attachmentType,
    });
    setApplying(false);
    if (error) { showToast(error.message, "error"); return; }
    setApplications((prev) => ({ ...prev, [applyJob.id]: "pending" }));
    showToast("Application sent!", "success");
    setApplyJob(null);
    setApplyMessage("");
    setApplyRate("");
    setApplyLinks("");
    setApplyFile(null);
  }

  if (loading || !profile || !userId) {
    return (
      <div className="min-h-screen bg-[var(--color-page)]">
        <NoIndexMeta />
        <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <Container className="flex h-16 items-center"><Logo size="md" /></Container>
        </header>
        <Container className="py-10 sm:py-14 space-y-6">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-5 w-96" />
          <Skeleton className="h-32 w-full" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
          </div>
        </Container>
      </div>
    );
  }

  const completeness = getArtistProfileCompleteness(profile);

  const actions: Action[] = [
    { title: "Edit Profile", description: "Update your bio, pricing, and portfolio.", href: "/create-profile", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /> },
    { title: "Preview Profile", description: "See exactly what clients see when they find you.", href: "/profile-preview", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /> },
  ];

  const openJobs = (jobs ?? []).filter((j) => j.status === "open");

  const jobFilterOptions = {
    categories: uniqueSorted(openJobs.map((j) => j.art_form)),
    states: uniqueSorted(openJobs.map((j) => j.state)),
    cities: uniqueSorted(openJobs.filter((j) => !jobState || j.state === jobState).map((j) => j.city)),
    eventTypes: uniqueSorted(openJobs.map((j) => j.event_type)),
  };

  const filteredJobs = openJobs.filter((j) => {
    if (jobCategory && j.art_form !== jobCategory) return false;
    if (jobState && j.state !== jobState) return false;
    if (jobCity && j.city !== jobCity) return false;
    if (jobEventType && j.event_type !== jobEventType) return false;
    return true;
  });

  const jobFiltersActive = !!(jobCategory || jobState || jobCity || jobEventType);

  return (
    <div className="min-h-screen bg-[var(--color-page)]">
      <NoIndexMeta />
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <Container className="flex h-16 items-center justify-between">
          <Logo size="md" />
          <ArtistNav active="dashboard" />
        </Container>
      </header>

      <Container className="py-10 sm:py-14">
        <h1 className="text-3xl">Welcome back, {profile.fullName || profile.stageName || "Artist"}</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">See what jobs are open, manage your profile, and stay on top of messages.</p>

        <div className="mt-8 grid lg:grid-cols-3 gap-8">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Open jobs */}
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text)] mb-4">Open jobs</h2>

              {openJobs.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <Select aria-label="Category" value={jobCategory} onChange={(e) => setJobCategory(e.target.value)}>
                    <option value="">All categories</option>
                    {jobFilterOptions.categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                  <Select aria-label="State" value={jobState} onChange={(e) => { setJobState(e.target.value); setJobCity(""); }}>
                    <option value="">All states</option>
                    {jobFilterOptions.states.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                  <Select aria-label="City" value={jobCity} onChange={(e) => setJobCity(e.target.value)}>
                    <option value="">All cities</option>
                    {jobFilterOptions.cities.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                  <Select aria-label="Event type" value={jobEventType} onChange={(e) => setJobEventType(e.target.value)}>
                    <option value="">All event types</option>
                    {jobFilterOptions.eventTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </div>
              )}

              {openJobs.length === 0 ? (
                <Card className="p-6">
                  <EmptyState title="No open jobs right now" description="Check back soon — clients post new events regularly." />
                </Card>
              ) : filteredJobs.length === 0 ? (
                <Card className="p-6">
                  <EmptyState
                    title="No jobs match your filters"
                    description="Try widening your search."
                    action={jobFiltersActive ? <Button size="sm" variant="outline" onClick={() => { setJobCategory(""); setJobState(""); setJobCity(""); setJobEventType(""); }}>Clear filters</Button> : undefined}
                  />
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredJobs.map((job) => {
                    const applied = applications[job.id];
                    return (
                      <Card key={job.id} className="p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-[var(--color-text)]">{job.title}</p>
                            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Posted by {job.client_name}</p>
                            <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                              {job.art_form}{job.event_type ? ` · ${job.event_type}` : ""} · {formatJobLocation(job)}
                            </p>
                            <p className="text-sm text-[var(--color-text-secondary)]">
                              {formatBudget(job)}{job.event_date ? ` · ${new Date(job.event_date).toLocaleDateString()}` : job.date_flexible ? " · Flexible date" : ""}
                            </p>
                          </div>
                          {applied && <Badge variant={APPLICATION_BADGE[applied]}>{applied}</Badge>}
                        </div>
                        {job.description && <p className="mt-3 text-sm text-[var(--color-text)] whitespace-pre-line">{job.description}</p>}
                        <div className="mt-4">
                          {applied ? (
                            <Button size="sm" variant="ghost" disabled>Applied</Button>
                          ) : (
                            <Button size="sm" variant="primary" onClick={() => { setApplyJob(job); setApplyMessage(""); setApplyRate(""); setApplyLinks(""); setApplyFile(null); }}>Apply</Button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Profile status */}
            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-[var(--color-text)]">Profile</h2>
                <Badge variant={profile.status === "published" ? "success" : "warning"}>
                  {profile.status === "published" ? "Published" : "Draft"}
                </Badge>
              </div>
              <div className="mt-4 h-2.5 w-full rounded-full bg-[var(--color-primary-soft)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500" style={{ width: `${completeness.percentage}%` }}
                  role="progressbar" aria-valuenow={completeness.percentage} aria-valuemin={0} aria-valuemax={100} />
              </div>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{completeness.percentage}% complete</p>
              {!completeness.publishable && (
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Missing: {completeness.missingFields.join(", ")}</p>
              )}
              <div className="mt-5 flex flex-col gap-2">
                <Button href={`/artists/${profile.slug || userId}`} variant="outline" size="sm">View Public Profile</Button>
                <Button type="button" variant="ghost" size="sm" onClick={togglePublishStatus} disabled={togglingStatus}>
                  {togglingStatus ? "Updating…" : profile.status === "published" ? "Unpublish" : "Publish profile"}
                </Button>
              </div>
            </Card>

            {/* Quick actions */}
            <Card className="p-6">
              <h2 className="text-base font-semibold text-[var(--color-text)] mb-3">Quick actions</h2>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={openPanel}
                  className="w-full flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-left hover:bg-[var(--color-primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                >
                  <svg className="w-5 h-5 text-[var(--color-primary)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>
                  <span className="text-sm font-medium text-[var(--color-text)]">Messages</span>
                </button>
                {actions.map((action) => (
                  <a
                    key={action.title}
                    href={action.href}
                    className="w-full flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-left hover:bg-[var(--color-primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                  >
                    <svg className="w-5 h-5 text-[var(--color-primary)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">{action.icon}</svg>
                    <span className="text-sm font-medium text-[var(--color-text)]">{action.title}</span>
                  </a>
                ))}
              </div>
            </Card>

            {/* Availability */}
            <Card className="p-6">
              <h2 className="text-base font-semibold text-[var(--color-text)]">Availability</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="neutral">{profile.availabilityStatus || "Not set"}</Badge>
                {profile.workMode && <Badge variant="secondary">{profile.workMode}</Badge>}
              </div>
              <div className="mt-4">
                <Button href="/create-profile?step=4" variant="outline" size="sm">Update availability</Button>
              </div>
            </Card>

            {/* Account */}
            <Card className="p-6">
              <h2 className="text-base font-semibold text-[var(--color-text)]">Account</h2>
              <div className="mt-4 flex flex-col gap-2 items-start">
                <Button href="/create-profile?step=5" variant="outline" size="sm">Edit account</Button>
                <Button type="button" variant="ghost" size="sm" onClick={handleSignOut}>Sign out</Button>
              </div>
            </Card>
          </div>
        </div>
      </Container>

      <Modal open={!!applyJob} onClose={() => setApplyJob(null)} title={applyJob ? `Apply — ${applyJob.title}` : undefined}>
        {applyJob && (
          <form onSubmit={submitApplication} className="space-y-4">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Posted by {applyJob.client_name} · {formatBudget(applyJob)} · {formatJobLocation(applyJob)}
            </p>
            <Input
              label="Your rate"
              optional
              placeholder="e.g. ₹25,000"
              value={applyRate}
              onChange={(e) => setApplyRate(e.target.value)}
            />
            <Textarea
              label="Message"
              optional
              rows={4}
              placeholder="Introduce yourself and say why you're a good fit…"
              value={applyMessage}
              onChange={(e) => setApplyMessage(e.target.value)}
            />
            <Textarea
              label="Links"
              optional
              rows={2}
              placeholder="Portfolio, YouTube, or social links — one per line"
              value={applyLinks}
              onChange={(e) => setApplyLinks(e.target.value)}
            />
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                Attachment <span className="text-[var(--color-text-secondary)] font-normal">(optional)</span>
              </label>
              <label
                className="flex items-center gap-2 cursor-pointer rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-soft)]
                  has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-accent)]"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01" /></svg>
                <span className="truncate">{applyFile ? applyFile.name : "Add a video, photo, or PDF"}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,application/pdf"
                  className="hidden"
                  onChange={(e) => setApplyFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {applyFile && (
                <button type="button" className="mt-1 text-xs text-[var(--color-text-secondary)] underline hover:text-[var(--color-text)]" onClick={() => setApplyFile(null)}>Remove attachment</button>
              )}
            </div>
            <Button type="submit" variant="primary" fullWidth disabled={applying}>{applying ? "Sending…" : "Send application"}</Button>
          </form>
        )}
      </Modal>
    </div>
  );
}
