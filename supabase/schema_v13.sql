-- Run this in the Supabase SQL Editor AFTER schema_v12.sql.
--
-- Job postings: a client posts an event/gig, artists apply to it. Kept
-- deliberately minimal — no bidding, no multi-stage pipeline, no separate
-- "shortlisted" state. A job is open or closed; an application is pending,
-- accepted, or declined. Once a client accepts an applicant, the existing
-- messaging system (start_conversation) is how they actually talk — this
-- schema doesn't duplicate chat.

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  art_form text not null default '',
  event_type text not null default '',
  city text not null default '',
  state text not null default '',
  event_date date,
  date_flexible boolean not null default false,
  budget_min text not null default '',
  budget_max text not null default '',
  description text not null default '',
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.jobs enable row level security;

create index if not exists jobs_client_id_idx on public.jobs(client_id);
create index if not exists jobs_status_idx on public.jobs(status);

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- Any authenticated artist can browse open jobs; a client can always see
-- their own regardless of status (so a closed job still shows in "My Jobs").
create policy "Open jobs are readable by authenticated users, own jobs always readable"
  on public.jobs for select
  using (status = 'open' or auth.uid() = client_id);

create policy "Clients can post their own jobs"
  on public.jobs for insert
  with check (auth.uid() = client_id);

create policy "Clients can update their own jobs"
  on public.jobs for update
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

-- ─── Applications ───────────────────────────────────────────────────────────
create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  message text not null default '',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (job_id, artist_id)
);

alter table public.job_applications enable row level security;

create index if not exists job_applications_job_id_idx on public.job_applications(job_id);
create index if not exists job_applications_artist_id_idx on public.job_applications(artist_id);

create or replace function public.stamp_job_application_responded_at()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    new.responded_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists job_applications_stamp_responded on public.job_applications;
create trigger job_applications_stamp_responded
  before update on public.job_applications
  for each row execute function public.stamp_job_application_responded_at();

create policy "Artists can view their own applications"
  on public.job_applications for select
  using (auth.uid() = artist_id);

create policy "Clients can view applications to their own jobs"
  on public.job_applications for select
  using (exists (select 1 from public.jobs j where j.id = job_applications.job_id and j.client_id = auth.uid()));

create policy "Artists can apply to open jobs"
  on public.job_applications for insert
  with check (
    auth.uid() = artist_id
    and exists (select 1 from public.jobs j where j.id = job_applications.job_id and j.status = 'open')
  );

create policy "Clients can accept or decline applications to their jobs"
  on public.job_applications for update
  using (exists (select 1 from public.jobs j where j.id = job_applications.job_id and j.client_id = auth.uid()))
  with check (exists (select 1 from public.jobs j where j.id = job_applications.job_id and j.client_id = auth.uid()));

-- ─── Applicant listing for the client's "My Jobs" view ─────────────────────
-- SECURITY DEFINER so a client can see the applying artist's public-safe
-- profile fields (name, photo, headline) without needing artists_public
-- select access widened for this specific join.
create or replace function public.list_job_applicants(p_job_id uuid)
returns table (
  application_id uuid,
  artist_id uuid,
  artist_name text,
  artist_photo text,
  artist_headline text,
  message text,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.jobs j where j.id = p_job_id and j.client_id = auth.uid()) then
    return;
  end if;

  return query
  select
    ja.id,
    a.id,
    coalesce(nullif(a.stage_name, ''), nullif(a.full_name, ''), 'Artist'),
    a.profile_picture_url,
    a.headline,
    ja.message,
    ja.status,
    ja.created_at
  from public.job_applications ja
  join public.artists a on a.id = ja.artist_id
  where ja.job_id = p_job_id
  order by ja.created_at desc;
end;
$$;

revoke all on function public.list_job_applicants(uuid) from public;
grant execute on function public.list_job_applicants(uuid) to authenticated;
