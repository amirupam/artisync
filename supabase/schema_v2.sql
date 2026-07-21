-- Run this in the Supabase SQL Editor AFTER schema.sql and storage.sql.
-- Adds the fields/tables needed for the Phase 5-7 profile wizard, dashboard,
-- enquiries, and saved-artists features. All new artist columns are
-- nullable-safe with defaults, so existing rows remain valid.

-- ─── New artist fields ──────────────────────────────────────────────────────
alter table public.artists
  add column if not exists stage_name text not null default '',
  add column if not exists headline text not null default '',
  add column if not exists travel_preference text not null default '',
  add column if not exists skills text[] not null default '{}',
  add column if not exists genres text[] not null default '{}',
  add column if not exists instruments text[] not null default '{}',
  add column if not exists group_type text not null default '',
  add column if not exists availability_status text not null default '',
  add column if not exists work_mode text not null default '',
  add column if not exists booking_types text[] not null default '{}',
  add column if not exists pricing_unit text not null default '',
  add column if not exists price_negotiable boolean not null default false,
  add column if not exists travel_available boolean not null default false,
  add column if not exists event_duration text not null default '',
  add column if not exists equipment_info text not null default '',
  add column if not exists preferred_contact_method text not null default '',
  add column if not exists website text not null default '',
  add column if not exists status text not null default 'draft';

-- ─── Enquiries ───────────────────────────────────────────────────────────────
create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null default '',
  event_date date,
  location text not null default '',
  message text not null default '',
  status text not null default 'new',
  created_at timestamptz not null default now()
);

alter table public.enquiries enable row level security;

create policy "Artists can read enquiries sent to them"
  on public.enquiries for select
  using (auth.uid() = artist_id);

create policy "Clients can read their own sent enquiries"
  on public.enquiries for select
  using (auth.uid() = client_id);

create policy "Clients can send enquiries"
  on public.enquiries for insert
  with check (auth.uid() = client_id);

create policy "Artists can update the status of their enquiries"
  on public.enquiries for update
  using (auth.uid() = artist_id)
  with check (auth.uid() = artist_id);

-- ─── Saved artists (client bookmarks) ───────────────────────────────────────
create table if not exists public.saved_artists (
  client_id uuid not null references auth.users(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, artist_id)
);

alter table public.saved_artists enable row level security;

create policy "Clients manage their own saved artists"
  on public.saved_artists for all
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);
