-- Run this in the Supabase SQL Editor AFTER schema_v13.sql.
--
-- Three changes:
--   1. Jobs can only be posted by an account that actually has a `clients`
--      row — previously the insert policy only checked `client_id =
--      auth.uid()`, which any signed-in artist could also satisfy by
--      passing their own id.
--   2. Messaging is opened up so an artist can message another artist, not
--      just a client messaging an artist. The `conversations` table's
--      `artist_id`/`client_id` columns are kept as-is (a conversation is
--      always addressed "to" an artist profile — the only kind of profile
--      that's publicly browsable), but the caller no longer has to be a
--      `clients` row, just a real platform user, and can't message
--      themselves. Because either side can now be an artist, the partner
--      lookup functions can no longer assume "whoever's in the client_id
--      slot is a client" — both are rewritten to check the artists table
--      first and fall back to clients.
--   3. Job applications get a proposed rate, optional links, and an
--      optional file/video attachment, stored in a new private bucket.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Jobs: posting requires an actual client row
-- ═══════════════════════════════════════════════════════════════════════════
drop policy if exists "Clients can post their own jobs" on public.jobs;
create policy "Clients can post their own jobs"
  on public.jobs for insert
  with check (
    auth.uid() = client_id
    and exists (select 1 from public.clients where id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Messaging: allow artist-to-artist, fix partner lookups
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.start_conversation(p_artist_id uuid)
returns public.conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation public.conversations;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if auth.uid() = p_artist_id then
    raise exception 'Cannot message yourself';
  end if;

  if not exists (select 1 from public.clients where id = auth.uid())
     and not exists (select 1 from public.artists where id = auth.uid()) then
    raise exception 'Complete your profile before messaging someone';
  end if;

  if not exists (select 1 from public.artists where id = p_artist_id and status = 'published') then
    raise exception 'Artist not found';
  end if;

  -- Check both orderings: an artist messaging another artist could already
  -- have a thread open in either direction depending on who messaged first.
  select * into v_conversation from public.conversations
    where (artist_id = p_artist_id and client_id = auth.uid())
       or (artist_id = auth.uid() and client_id = p_artist_id);

  if found then
    return v_conversation;
  end if;

  insert into public.conversations (artist_id, client_id, status)
  values (p_artist_id, auth.uid(), 'active')
  returning * into v_conversation;

  return v_conversation;
end;
$$;

-- Partner display info, generic: whichever side auth.uid() ISN'T on is the
-- partner, and that partner's identity is resolved by checking the artists
-- table first (an artist-to-artist thread has an artist on both sides) and
-- falling back to clients.
create or replace function public.get_conversation_partner(p_conversation_id uuid)
returns table (user_id uuid, display_name text, profile_picture_url text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_artist_id uuid;
  v_client_id uuid;
  v_partner_id uuid;
begin
  select c.artist_id, c.client_id into v_artist_id, v_client_id
  from public.conversations c
  where c.id = p_conversation_id
    and (c.artist_id = auth.uid() or c.client_id = auth.uid());

  if v_artist_id is null then
    return;
  end if;

  v_partner_id := case when auth.uid() = v_artist_id then v_client_id else v_artist_id end;

  return query
    select a.id, coalesce(nullif(a.stage_name, ''), nullif(a.full_name, ''), 'Artist'), a.profile_picture_url
    from public.artists a where a.id = v_partner_id
  union all
    select cl.id, coalesce(nullif(cl.full_name, ''), 'Client'), ''::text
    from public.clients cl
    where cl.id = v_partner_id and not exists (select 1 from public.artists a2 where a2.id = v_partner_id)
  limit 1;
end;
$$;

-- Chat-bar inbox listing, same generic partner resolution.
create or replace function public.list_my_conversations()
returns table (
  conversation_id uuid,
  partner_id uuid,
  partner_name text,
  partner_photo text,
  status text,
  last_message_body text,
  last_message_at timestamptz,
  unread_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  return query
  select
    c.id,
    p.partner_id,
    coalesce(nullif(pa.stage_name, ''), nullif(pa.full_name, ''), nullif(pc.full_name, ''), 'User'),
    coalesce(pa.profile_picture_url, ''::text),
    c.status,
    lm.body,
    coalesce(lm.created_at, c.created_at),
    (
      select count(*) from public.messages m
      where m.conversation_id = c.id
        and m.sender_id <> auth.uid()
        and m.created_at > (case when c.artist_id = auth.uid() then c.artist_last_read_at else c.client_last_read_at end)
    )
  from public.conversations c
  cross join lateral (select case when c.artist_id = auth.uid() then c.client_id else c.artist_id end as partner_id) p
  left join public.artists pa on pa.id = p.partner_id
  left join public.clients pc on pc.id = p.partner_id
  left join lateral (
    select body, created_at from public.messages
    where conversation_id = c.id
    order by created_at desc
    limit 1
  ) lm on true
  where c.artist_id = auth.uid() or c.client_id = auth.uid()
  order by coalesce(lm.created_at, c.created_at) desc;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Richer job applications: proposed rate, links, optional attachment
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.job_applications
  add column if not exists proposed_rate text not null default '',
  add column if not exists links text not null default '',
  add column if not exists attachment_url text,
  add column if not exists attachment_type text;

create or replace function public.list_job_applicants(p_job_id uuid)
returns table (
  application_id uuid,
  artist_id uuid,
  artist_name text,
  artist_photo text,
  artist_headline text,
  message text,
  proposed_rate text,
  links text,
  attachment_url text,
  attachment_type text,
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
    ja.proposed_rate,
    ja.links,
    ja.attachment_url,
    ja.attachment_type,
    ja.status,
    ja.created_at
  from public.job_applications ja
  join public.artists a on a.id = ja.artist_id
  where ja.job_id = p_job_id
  order by ja.created_at desc;
end;
$$;

-- ─── Private storage bucket for application attachments ───────────────────
-- Path convention: `${job_id}/${artist_id}/${filename}` — lets both the
-- read policy (client of that job) and the natural "my own upload" case
-- (the applying artist) be checked without a join back through messages.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-applications', 'job-applications', false, 26214400,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm','application/pdf']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Artists can upload their own application attachments" on storage.objects;
create policy "Artists can upload their own application attachments"
  on storage.objects for insert
  with check (
    bucket_id = 'job-applications'
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1 from public.jobs j
      where j.id::text = (storage.foldername(name))[1] and j.status = 'open'
    )
  );

drop policy if exists "Artist owner or job's client can read an application attachment" on storage.objects;
create policy "Artist owner or job's client can read an application attachment"
  on storage.objects for select
  using (
    bucket_id = 'job-applications'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or exists (
        select 1 from public.jobs j
        where j.id::text = (storage.foldername(name))[1] and j.client_id = auth.uid()
      )
    )
  );
