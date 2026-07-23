import { supabase } from "@/lib/supabaseClient";

export type JobStatus = "open" | "closed";
export type ApplicationStatus = "pending" | "accepted" | "declined";

export type JobRow = {
  id: string;
  client_id: string;
  title: string;
  art_form: string;
  event_type: string;
  city: string;
  state: string;
  event_date: string | null;
  date_flexible: boolean;
  budget_min: string;
  budget_max: string;
  description: string;
  status: JobStatus;
  created_at: string;
  updated_at: string;
};

export type JobApplicant = {
  application_id: string;
  artist_id: string;
  artist_name: string;
  artist_photo: string;
  artist_headline: string;
  message: string;
  proposed_rate: string;
  links: string;
  attachment_url: string | null;
  attachment_type: string | null;
  status: ApplicationStatus;
  created_at: string;
};

export const JOB_APPLICATION_BUCKET = "job-applications";

export function formatBudget(job: Pick<JobRow, "budget_min" | "budget_max">): string {
  if (job.budget_min && job.budget_max) return `₹${job.budget_min} – ₹${job.budget_max}`;
  if (job.budget_min) return `From ₹${job.budget_min}`;
  if (job.budget_max) return `Up to ₹${job.budget_max}`;
  return "Budget not specified";
}

export function formatJobLocation(job: Pick<JobRow, "city" | "state">): string {
  return [job.city, job.state].filter(Boolean).join(", ") || "Location not specified";
}

/** Open jobs any signed-in artist can browse and apply to. */
export async function listOpenJobs() {
  return supabase.from("jobs").select("*").eq("status", "open").order("created_at", { ascending: false });
}

/** The current client's own jobs, open or closed. */
export async function listMyJobs(clientId: string) {
  return supabase.from("jobs").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
}

export async function postJob(job: Omit<JobRow, "id" | "created_at" | "updated_at" | "status">) {
  return supabase.from("jobs").insert(job).select().single();
}

export async function closeJob(jobId: string) {
  return supabase.from("jobs").update({ status: "closed" }).eq("id", jobId);
}

export async function reopenJob(jobId: string) {
  return supabase.from("jobs").update({ status: "open" }).eq("id", jobId);
}

/** The current artist's own applications — used to show "Applied" instead of the Apply button. */
export async function listMyApplications(artistId: string) {
  return supabase.from("job_applications").select("job_id, status").eq("artist_id", artistId);
}

export async function applyToJob(
  jobId: string,
  artistId: string,
  fields: { message: string; proposedRate: string; links: string; attachmentUrl?: string | null; attachmentType?: string | null }
) {
  return supabase.from("job_applications").insert({
    job_id: jobId,
    artist_id: artistId,
    message: fields.message.trim(),
    proposed_rate: fields.proposedRate.trim(),
    links: fields.links.trim(),
    attachment_url: fields.attachmentUrl ?? null,
    attachment_type: fields.attachmentType ?? null,
  });
}

export async function uploadApplicationAttachment(jobId: string, artistId: string, file: File) {
  const path = `${jobId}/${artistId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from(JOB_APPLICATION_BUCKET).upload(path, file);
  if (error) return { path: null, error };
  return { path, error: null };
}

export async function getApplicationAttachmentUrl(path: string) {
  const { data } = await supabase.storage.from(JOB_APPLICATION_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export async function listJobApplicants(jobId: string) {
  return supabase.rpc("list_job_applicants", { p_job_id: jobId });
}

export async function respondToApplication(applicationId: string, status: "accepted" | "declined") {
  return supabase.from("job_applications").update({ status }).eq("id", applicationId);
}
