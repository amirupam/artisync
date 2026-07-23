-- Run this in the Supabase SQL Editor AFTER schema_v10.sql.
--
-- Product change: chat no longer requires an artist to "accept" an enquiry
-- before a conversation opens. Messaging works like a normal inbox — a
-- client clicks Message on an artist's profile and a conversation exists
-- immediately, the same way LinkedIn messaging has no accept/decline gate.
-- The enquiries table and its accept/decline lifecycle are left in place
-- (existing rows and conversations tied to them keep working) but are no
-- longer the only way to create a conversation.

-- ─── Conversations no longer require an enquiry ────────────────────────────
alter table public.conversations alter column enquiry_id drop not null;

-- One conversation per artist/client pair, whether it started from an
-- enquiry or directly. Existing rows were already unique per enquiry_id;
-- this adds the same guarantee for the direct-start path. `add constraint`
-- has no `if not exists` form, so this checks first to stay safe to re-run.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'conversations_artist_client_unique'
  ) then
    alter table public.conversations
      add constraint conversations_artist_client_unique unique (artist_id, client_id);
  end if;
end $$;

-- ─── Per-participant read tracking (for unread badges in the chat bar) ────
alter table public.conversations
  add column if not exists artist_last_read_at timestamptz not null default now(),
  add column if not exists client_last_read_at timestamptz not null default now();

-- Bump updated_at whenever a new message lands, so "most recent activity"
-- ordering in the chat bar reflects messages, not just conversation creation.
create or replace function public.bump_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_bump_conversation on public.messages;
create trigger messages_bump_conversation
  after insert on public.messages
  for each row execute function public.bump_conversation_on_message();

-- ─── Direct conversation start (get-or-create, no enquiry needed) ─────────
-- SECURITY DEFINER so this is the only path that inserts a conversation
-- without going through the enquiry-acceptance trigger — mirrors how that
-- trigger already bypasses RLS. Only a client can initiate; only against a
-- published artist. Returns the existing conversation if one already exists
-- for this artist/client pair, so re-clicking "Message" never duplicates it.
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

  if not exists (select 1 from public.clients where id = auth.uid()) then
    raise exception 'Only clients can start a conversation';
  end if;

  if not exists (select 1 from public.artists where id = p_artist_id and status = 'published') then
    raise exception 'Artist not found';
  end if;

  select * into v_conversation from public.conversations
    where artist_id = p_artist_id and client_id = auth.uid();

  if found then
    return v_conversation;
  end if;

  insert into public.conversations (artist_id, client_id, status)
  values (p_artist_id, auth.uid(), 'active')
  returning * into v_conversation;

  return v_conversation;
end;
$$;

revoke all on function public.start_conversation(uuid) from public;
grant execute on function public.start_conversation(uuid) to authenticated;

-- ─── Mark-as-read ───────────────────────────────────────────────────────────
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set artist_last_read_at = case when artist_id = auth.uid() then now() else artist_last_read_at end,
      client_last_read_at = case when client_id = auth.uid() then now() else client_last_read_at end
  where id = p_conversation_id
    and (artist_id = auth.uid() or client_id = auth.uid());
end;
$$;

revoke all on function public.mark_conversation_read(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- ─── Chat-bar inbox listing ─────────────────────────────────────────────────
-- One call returns everything the LinkedIn-style chat bar needs: partner
-- identity, last message preview, and unread count — avoiding an N+1 query
-- per conversation from the client. SECURITY DEFINER so it can read the
-- partner's name/photo across the artists/clients tables the same way
-- get_conversation_partner() already does, scoped to auth.uid()'s own rows.
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
    case when c.artist_id = auth.uid() then cl.id else a.id end,
    case when c.artist_id = auth.uid() then coalesce(nullif(cl.full_name, ''), 'Client') else coalesce(nullif(a.stage_name, ''), nullif(a.full_name, ''), 'Artist') end,
    case when c.artist_id = auth.uid() then ''::text else a.profile_picture_url end,
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
  left join public.artists a on a.id = c.artist_id
  left join public.clients cl on cl.id = c.client_id
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

revoke all on function public.list_my_conversations() from public;
grant execute on function public.list_my_conversations() to authenticated;
