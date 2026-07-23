-- Run this in the Supabase SQL Editor AFTER schema_v14.sql.
--
-- Three fixes/additions:
--   1. start_conversation reactivates a conversation the user or the artist
--      previously closed (closed_by_artist/closed_by_client) instead of
--      handing back a dead thread that renders "This conversation is
--      closed" — nobody explicitly closed it from the client's point of
--      view, they just clicked Message on someone they'd talked to before.
--      A `blocked` conversation is deliberately left alone — blocking is
--      meant to be permanent (see schema_v6.sql).
--   2. list_job_applicants also returns the artist's public slug, so the
--      client's My Jobs page can link an applicant straight to their
--      public profile.
--   3. A new list_my_pending_applications() function powers a client-side
--      notification bell — "who applied" across every job the client has
--      posted, not just one at a time.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Reopen a previously-closed (not blocked) conversation
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

  select * into v_conversation from public.conversations
    where (artist_id = p_artist_id and client_id = auth.uid())
       or (artist_id = auth.uid() and client_id = p_artist_id);

  if found then
    if v_conversation.status in ('closed_by_artist', 'closed_by_client') then
      update public.conversations set status = 'active' where id = v_conversation.id
        returning * into v_conversation;
    end if;
    return v_conversation;
  end if;

  insert into public.conversations (artist_id, client_id, status)
  values (p_artist_id, auth.uid(), 'active')
  returning * into v_conversation;

  return v_conversation;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. list_job_applicants: also return the artist's public slug
-- ═══════════════════════════════════════════════════════════════════════════
drop function if exists public.list_job_applicants(uuid);

create function public.list_job_applicants(p_job_id uuid)
returns table (
  application_id uuid,
  artist_id uuid,
  artist_name text,
  artist_slug text,
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
    a.slug,
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

revoke all on function public.list_job_applicants(uuid) from public;
grant execute on function public.list_job_applicants(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Notification bell: pending applications across all of a client's jobs
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.list_my_pending_applications()
returns table (
  application_id uuid,
  job_id uuid,
  job_title text,
  artist_id uuid,
  artist_name text,
  artist_slug text,
  artist_photo text,
  created_at timestamptz
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
    ja.id,
    j.id,
    j.title,
    a.id,
    coalesce(nullif(a.stage_name, ''), nullif(a.full_name, ''), 'Artist'),
    a.slug,
    a.profile_picture_url,
    ja.created_at
  from public.job_applications ja
  join public.jobs j on j.id = ja.job_id
  join public.artists a on a.id = ja.artist_id
  where j.client_id = auth.uid() and ja.status = 'pending'
  order by ja.created_at desc;
end;
$$;

revoke all on function public.list_my_pending_applications() from public;
grant execute on function public.list_my_pending_applications() to authenticated;
