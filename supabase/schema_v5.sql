-- Run this in the Supabase SQL Editor AFTER schema.sql, storage.sql, schema_v2.sql,
-- schema_v3.sql, and schema_v4.sql.
--
-- Phase 2 (Database Design) of the private client-artist communication system.
-- This file only defines table structure, constraints, indexes, and the
-- integrity triggers that tie tables together. Row Level Security is
-- enabled on every new table but NO ACCESS POLICIES are added yet — with
-- RLS enabled and zero policies, a table denies all access to every role
-- by default. Until Phase 3 adds policies, none of this is readable or
-- writable by anon/authenticated clients. Nothing in this file touches the
-- existing public.artists select policy; that is a deliberately separate,
-- higher-risk change reviewed on its own in Phase 3.

-- ─── Enquiries: extend status lifecycle ────────────────────────────────────
alter table public.enquiries
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists responded_at timestamptz;

alter table public.enquiries drop constraint if exists enquiries_status_check;
alter table public.enquiries
  add constraint enquiries_status_check
  check (status in ('new', 'interested', 'needs_details', 'not_available', 'closed'));

drop trigger if exists enquiries_set_updated_at on public.enquiries;
create trigger enquiries_set_updated_at
  before update on public.enquiries
  for each row execute function public.set_updated_at();

-- ─── Conversations ──────────────────────────────────────────────────────────
-- A conversation is created automatically (via trigger, below) only when an
-- enquiry's status moves to 'interested' or 'needs_details'. There is
-- deliberately no direct insert policy for clients/artists on this table —
-- the trigger (running as SECURITY DEFINER) is the only path that creates a
-- row, which guarantees a conversation can never exist without a
-- corresponding accepted enquiry, regardless of what the frontend does.
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null unique references public.enquiries(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'closed_by_artist', 'closed_by_client', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.conversations enable row level security;

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

create index if not exists conversations_artist_id_idx on public.conversations(artist_id);
create index if not exists conversations_client_id_idx on public.conversations(client_id);

-- Auto-create a conversation when an enquiry is accepted, and stamp
-- responded_at on any status change. SECURITY DEFINER so this succeeds
-- regardless of the RLS policies conversations ends up with in Phase 3.
create or replace function public.handle_enquiry_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('interested', 'needs_details')
     and (old.status is distinct from new.status) then
    insert into public.conversations (enquiry_id, artist_id, client_id)
    values (new.id, new.artist_id, new.client_id)
    on conflict (enquiry_id) do nothing;
  end if;

  if new.status is distinct from old.status then
    new.responded_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists enquiries_handle_status_change on public.enquiries;
create trigger enquiries_handle_status_change
  before update on public.enquiries
  for each row execute function public.handle_enquiry_status_change();

-- ─── Messages ───────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '',
  attachment_url text,
  attachment_type text,
  flagged_contact_leak boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create index if not exists messages_conversation_id_idx on public.messages(conversation_id, created_at);

-- ─── Contact share requests (mutual-consent contact exchange) ──────────────
-- Either party can ask to see the other's contact details; only the
-- contact_owner_id (whose info would be revealed) can approve or decline.
create table if not exists public.contact_share_requests (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  contact_owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined', 'revoked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint contact_share_requester_not_owner check (requested_by <> contact_owner_id)
);

alter table public.contact_share_requests enable row level security;

create unique index if not exists contact_share_requests_unique_pending
  on public.contact_share_requests (conversation_id, requested_by, contact_owner_id)
  where status = 'pending';

-- ─── Conversation blocks ────────────────────────────────────────────────────
create table if not exists public.conversation_blocks (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  blocked_by uuid not null references auth.users(id) on delete cascade,
  reason text not null default '',
  created_at timestamptz not null default now(),
  unique (conversation_id, blocked_by)
);

alter table public.conversation_blocks enable row level security;

-- Blocking closes the conversation immediately from either side, enforced
-- by trigger rather than left to client-side logic.
create or replace function public.handle_conversation_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set status = 'blocked'
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists conversation_blocks_after_insert on public.conversation_blocks;
create trigger conversation_blocks_after_insert
  after insert on public.conversation_blocks
  for each row execute function public.handle_conversation_block();

-- ─── Reports ────────────────────────────────────────────────────────────────
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete set null,
  reported_by uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null default '',
  details text not null default '',
  status text not null default 'open'
    check (status in ('open', 'reviewed', 'dismissed', 'actioned')),
  created_at timestamptz not null default now(),
  constraint reports_not_self check (reported_by <> reported_user_id)
);

alter table public.reports enable row level security;
