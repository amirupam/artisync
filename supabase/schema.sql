-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query)

-- ─── artists table ──────────────────────────────────────────────────────────
create table if not exists public.artists (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  bio text not null default '',
  profile_picture_url text not null default '',
  cover_banner_url text not null default '',
  art_form text not null default '',
  art_sub_forms text[] not null default '{}',
  experience text not null default '',
  languages text[] not null default '{}',
  event_types text[] not null default '{}',
  price_range text not null default '',
  youtube_videos text[] not null default '{}',
  youtube_video_captions text[] not null default '{}',
  performance_image_urls text[] not null default '{}',
  performance_image_captions text[] not null default '{}',
  state text not null default '',
  city text not null default '',
  area text not null default '',
  country text not null default 'India',
  phone text not null default '',
  email text not null default '',
  instagram text not null default '',
  facebook text not null default '',
  youtube text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.artists enable row level security;

-- Anyone (including anonymous visitors) can read artist profiles — the app lists/browses them publicly.
create policy "Artists are publicly readable"
  on public.artists for select
  using (true);

-- Only the owning user can create or update their own profile.
create policy "Users can insert their own artist profile"
  on public.artists for insert
  with check (auth.uid() = id);

create policy "Users can update their own artist profile"
  on public.artists for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ─── clients table ──────────────────────────────────────────────────────────
create table if not exists public.clients (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  state text not null default '',
  city text not null default '',
  email text not null default '',
  created_at timestamptz not null default now()
);

alter table public.clients enable row level security;

-- Clients only need to read/write their own record (used to check onboarding status).
create policy "Users can read their own client record"
  on public.clients for select
  using (auth.uid() = id);

create policy "Users can insert their own client record"
  on public.clients for insert
  with check (auth.uid() = id);

-- ─── updated_at trigger for artists ─────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists artists_set_updated_at on public.artists;
create trigger artists_set_updated_at
  before update on public.artists
  for each row execute function public.set_updated_at();
