import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { stripOAuthHashIfPresent } from "@/lib/stripOAuthHash";
import { listMyJobs, listJobApplicants, closeJob, reopenJob, respondToApplication, getApplicationAttachmentUrl, formatBudget, formatJobLocation, type JobRow, type JobApplicant } from "@/lib/jobs";
import { useChat } from "@/components/ChatContext";
import { useToast } from "@/components/Toast";
import Container from "@/components/Container";
import Logo from "@/components/Logo";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import NoIndexMeta from "@/components/NoIndexMeta";
import NotificationBell from "@/components/NotificationBell";

const STATUS_BADGE: Record<string, "neutral" | "accent" | "success" | "error"> = {
  pending: "accent",
  accepted: "success",
  declined: "error",
};

function AttachmentPreview({ path, type }: { path: string; type: string | null }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getApplicationAttachmentUrl(path).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [path]);

  if (!url) return <p className="text-xs text-[var(--color-text-secondary)] mt-2">Loading attachment…</p>;
  if (type?.startsWith("video/")) {
    return <video src={url} controls className="mt-2 max-h-56 rounded-[var(--radius-md)]" />;
  }
  if (type?.startsWith("image/")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="Application attachment" className="mt-2 max-h-56 rounded-[var(--radius-md)] object-contain" />;
  }
  return <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs underline text-[var(--color-accent)]">Download attachment</a>;
}

function JobCard({ job, onChanged, autoExpand }: { job: JobRow; onChanged: () => void; autoExpand?: boolean }) {
  const { openConversationWithArtist } = useChat();
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState(!!autoExpand);
  const [applicants, setApplicants] = useState<JobApplicant[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadApplicants = useCallback(async () => {
    const { data } = await listJobApplicants(job.id);
    setApplicants((data as JobApplicant[]) ?? []);
  }, [job.id]);

  useEffect(() => {
    if (expanded && applicants === null) loadApplicants();
  }, [expanded, applicants, loadApplicants]);

  async function toggleStatus() {
    if (job.status === "open") await closeJob(job.id);
    else await reopenJob(job.id);
    onChanged();
  }

  async function respond(applicationId: string, status: "accepted" | "declined") {
    setBusyId(applicationId);
    const { error } = await respondToApplication(applicationId, status);
    if (error) showToast(error.message, "error");
    else await loadApplicants();
    setBusyId(null);
  }

  async function message(artistId: string) {
    try {
      // openConversationWithArtist creates the conversation if it doesn't exist yet.
      await openConversationWithArtist(artistId);
    } catch {
      showToast("Could not open the conversation.", "error");
    }
  }

  const pendingCount = applicants?.filter((a) => a.status === "pending").length ?? 0;

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[var(--color-text)]">{job.title}</p>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            {job.art_form}{job.event_type ? ` · ${job.event_type}` : ""} · {formatJobLocation(job)}
          </p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {formatBudget(job)}{job.event_date ? ` · ${new Date(job.event_date).toLocaleDateString()}` : job.date_flexible ? " · Flexible date" : ""}
          </p>
        </div>
        <Badge variant={job.status === "open" ? "success" : "neutral"}>{job.status === "open" ? "Open" : "Closed"}</Badge>
      </div>

      {job.description && <p className="mt-4 text-sm text-[var(--color-text)] whitespace-pre-line">{job.description}</p>}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Hide applicants" : "View applicants"}
          {pendingCount > 0 && !expanded && ` (${pendingCount} new)`}
        </Button>
        <Button size="sm" variant="ghost" onClick={toggleStatus}>{job.status === "open" ? "Close job" : "Reopen job"}</Button>
      </div>

      {expanded && (
        <div className="mt-5 border-t border-[var(--color-border)] pt-5 space-y-3">
          {applicants === null ? (
            <div className="flex justify-center py-6"><LoadingSpinner size="sm" /></div>
          ) : applicants.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)]">No applicants yet.</p>
          ) : (
            applicants.map((a) => (
              <div key={a.application_id} className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
                <Link href={a.artist_slug ? `/artists/${a.artist_slug}` : "#"} className="flex-shrink-0">
                  {a.artist_photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.artist_photo} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[var(--color-primary-soft)]" />
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={a.artist_slug ? `/artists/${a.artist_slug}` : "#"} className="text-sm font-semibold text-[var(--color-text)] hover:text-[var(--color-accent)] hover:underline">{a.artist_name}</Link>
                    <Badge variant={STATUS_BADGE[a.status] ?? "neutral"}>{a.status}</Badge>
                  </div>
                  {a.artist_headline && <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{a.artist_headline}</p>}
                  {a.proposed_rate && (
                    <p className="text-sm font-semibold text-[var(--color-text)] mt-2">Rate: {a.proposed_rate}</p>
                  )}
                  {a.message && <p className="text-sm text-[var(--color-text)] mt-2">{a.message}</p>}
                  {a.links && (
                    <ul className="mt-2 space-y-0.5">
                      {a.links.split("\n").map((l) => l.trim()).filter(Boolean).map((link) => (
                        <li key={link}>
                          <a href={link} target="_blank" rel="noreferrer" className="text-xs underline text-[var(--color-accent)] break-all">{link}</a>
                        </li>
                      ))}
                    </ul>
                  )}
                  {a.attachment_url && <AttachmentPreview path={a.attachment_url} type={a.attachment_type} />}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {a.status === "pending" && (
                      <>
                        <Button size="sm" variant="primary" disabled={busyId === a.application_id} onClick={() => respond(a.application_id, "accepted")}>Accept</Button>
                        <Button size="sm" variant="outline" disabled={busyId === a.application_id} onClick={() => respond(a.application_id, "declined")}>Decline</Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => message(a.artist_id)}>Message</Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Card>
  );
}

export default function MyJobsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  const loadJobs = useCallback(async (clientId: string) => {
    const { data } = await listMyJobs(clientId);
    setJobs((data as JobRow[]) ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function handleUser(u: { id: string } | null | undefined) {
      if (cancelled) return;
      if (!u) { router.replace({ pathname: "/signup", query: { role: "client", returnTo: "/my-jobs" } }); return; }
      stripOAuthHashIfPresent();
      setUserId(u.id);
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

  if (loading || !userId) {
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
          <div className="flex items-center gap-3">
            <NotificationBell />
            <Button href="/artists" variant="ghost" size="sm">Back to Artists</Button>
          </div>
        </Container>
      </header>

      <Container className="py-10 sm:py-14 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl">Your jobs</h1>
            <p className="mt-2 text-[var(--color-text-secondary)]">Manage the events you&rsquo;ve posted and review who applied.</p>
          </div>
          <Button href="/post-job" variant="primary" size="sm">Post a job</Button>
        </div>

        {!jobs || jobs.length === 0 ? (
          <Card className="p-6">
            <EmptyState
              title="No jobs posted yet"
              description="Post your event and let artists apply directly to you."
              action={<Button href="/post-job" variant="primary" size="sm">Post a job</Button>}
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} onChanged={() => loadJobs(userId)} autoExpand={router.query.job === job.id} />
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}
