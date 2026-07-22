-- Run this in the Supabase SQL Editor AFTER schema_v5.sql.
--
-- Phase 3 (Row Level Security) of the private client-artist communication
-- system. Two things happen here:
--   1. Access policies for the tables created in schema_v5.sql.
--   2. The critical fix for the artists table: its contact fields
--      (phone, email, website, preferred_contact_method) are currently
--      readable by anyone via the "select using (true)" policy, regardless
--      of what the frontend chooses to render. This section locks the base
--      table down and introduces a public-safe view plus a consent-gated
--      function, so privacy is enforced by Postgres itself, not by UI code.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Conversations
-- ═══════════════════════════════════════════════════════════════════════════
-- No insert policy: rows are only created by the enquiries trigger
-- (schema_v5.sql), which runs as SECURITY DEFINER. This guarantees a
-- conversation can never be created except by an accepted enquiry.

create policy "Participants can view their conversations"
  on public.conversations for select
  using (auth.uid() = artist_id or auth.uid() = client_id);

create policy "Artist can close their own conversation"
  on public.conversations for update
  using (auth.uid() = artist_id and status = 'active')
  with check (auth.uid() = artist_id and status in ('active', 'closed_by_artist'));

create policy "Client can close their own conversation"
  on public.conversations for update
  using (auth.uid() = client_id and status = 'active')
  with check (auth.uid() = client_id and status in ('active', 'closed_by_client'));

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Messages
-- ═══════════════════════════════════════════════════════════════════════════
-- Chat history is immutable: no update/delete policies. Sending is only
-- allowed while the conversation is still 'active' (not closed or blocked).

create policy "Participants can read messages in their conversations"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.artist_id = auth.uid() or c.client_id = auth.uid())
    )
  );

create policy "Participants can send messages while the conversation is active"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.status = 'active'
        and (c.artist_id = auth.uid() or c.client_id = auth.uid())
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Contact share requests
-- ═══════════════════════════════════════════════════════════════════════════
-- Either participant can ask; only contact_owner_id may approve, decline,
-- or later revoke. Actual contact-detail retrieval goes through
-- get_contact_info() below — approving a request here does not, by itself,
-- expose any column, it only flips a flag that function checks.

create policy "Participants can view their contact share requests"
  on public.contact_share_requests for select
  using (auth.uid() = requested_by or auth.uid() = contact_owner_id);

create policy "Participants can request contact sharing"
  on public.contact_share_requests for insert
  with check (
    requested_by = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = contact_share_requests.conversation_id
        and c.status = 'active'
        and (
          (c.artist_id = requested_by and c.client_id = contact_owner_id)
          or (c.client_id = requested_by and c.artist_id = contact_owner_id)
        )
    )
  );

create policy "Owner can respond to a pending contact share request"
  on public.contact_share_requests for update
  using (auth.uid() = contact_owner_id and status = 'pending')
  with check (auth.uid() = contact_owner_id and status in ('approved', 'declined'));

create policy "Owner can revoke a previously approved contact share"
  on public.contact_share_requests for update
  using (auth.uid() = contact_owner_id and status = 'approved')
  with check (auth.uid() = contact_owner_id and status = 'revoked');

create or replace function public.stamp_contact_share_responded_at()
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

drop trigger if exists contact_share_requests_stamp_responded on public.contact_share_requests;
create trigger contact_share_requests_stamp_responded
  before update on public.contact_share_requests
  for each row execute function public.stamp_contact_share_responded_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Conversation blocks
-- ═══════════════════════════════════════════════════════════════════════════
-- No update/delete policies: blocking is permanent and irreversible by the
-- blocked party — unblocking is intentionally out of scope for regular users.

create policy "Participants can view blocks on their conversations"
  on public.conversation_blocks for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_blocks.conversation_id
        and (c.artist_id = auth.uid() or c.client_id = auth.uid())
    )
  );

create policy "Participants can block a conversation"
  on public.conversation_blocks for insert
  with check (
    blocked_by = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_blocks.conversation_id
        and (c.artist_id = auth.uid() or c.client_id = auth.uid())
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Reports
-- ═══════════════════════════════════════════════════════════════════════════
-- Reporters can see their own submissions only. There is no admin/moderator
-- role in this app yet, so review happens via the Supabase dashboard
-- (which bypasses RLS as the table owner) until an admin phase exists —
-- this is a deliberate, documented gap, not an oversight.

create policy "Reporters can view their own reports"
  on public.reports for select
  using (auth.uid() = reported_by);

create policy "Participants can file a report against their conversation partner"
  on public.reports for insert
  with check (
    reported_by = auth.uid()
    and reported_user_id <> reported_by
    and (
      conversation_id is null
      or exists (
        select 1 from public.conversations c
        where c.id = reports.conversation_id
          and (
            (c.artist_id = auth.uid() and c.client_id = reported_user_id)
            or (c.client_id = auth.uid() and c.artist_id = reported_user_id)
          )
      )
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Artists table: lock down contact columns at the database level
-- ═══════════════════════════════════════════════════════════════════════════

-- Replace the fully-public policy with an owner-only one. After this,
-- anon/authenticated clients querying public.artists directly get only
-- their own row (if any) — public browsing must go through the view below.
drop policy if exists "Artists are publicly readable" on public.artists;

create policy "Owners can read their own full artist row"
  on public.artists for select
  using (auth.uid() = id);

-- Public-safe view: every artist column except phone, email, website, and
-- preferred_contact_method. Owned by the same role as the base table, so
-- it reads every row regardless of the querying user's RLS visibility, but
-- can only ever return the columns listed here.
create or replace view public.artists_public as
select
  id, full_name, stage_name, headline, bio,
  profile_picture_url, cover_banner_url,
  art_form, art_sub_forms, skills, genres, instruments, group_type,
  experience, languages, event_types, price_range, pricing_unit,
  price_negotiable, availability_status, work_mode, booking_types,
  travel_available, travel_preference, event_duration, equipment_info,
  youtube_videos, youtube_video_captions,
  performance_image_urls, performance_image_captions,
  state, city, area, country,
  instagram, facebook, youtube,
  status, latitude, longitude,
  created_at, updated_at
from public.artists;

grant select on public.artists_public to anon, authenticated;

-- Consent-gated contact lookup. Works for both artists and clients: returns
-- a row only if the caller owns the profile, or an approved
-- contact_share_request exists naming the caller as requested_by and the
-- target as contact_owner_id. Returns zero rows otherwise — never an error
-- that would leak whether the target exists.
create or replace function public.get_contact_info(p_owner_id uuid)
returns table (
  phone text,
  email text,
  website text,
  preferred_contact_method text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  if auth.uid() <> p_owner_id and not exists (
    select 1 from public.contact_share_requests csr
    where csr.contact_owner_id = p_owner_id
      and csr.requested_by = auth.uid()
      and csr.status = 'approved'
  ) then
    return;
  end if;

  return query
    select a.phone, a.email, a.website, a.preferred_contact_method
    from public.artists a where a.id = p_owner_id
  union all
  select c.phone, c.email, ''::text, ''::text
    from public.clients c where c.id = p_owner_id;
end;
$$;

revoke all on function public.get_contact_info(uuid) from public;
grant execute on function public.get_contact_info(uuid) to authenticated;
