-- Run this in the Supabase SQL Editor AFTER schema_v8.sql.
--
-- Phase 4 (stable public artist profile URLs) of the discoverability work.
-- Adds a stable, human-readable `slug` to public.artists so profiles have a
-- permanent public URL (/artists/{slug}) instead of exposing the raw
-- database UUID. The slug is generated once, server-side, and never
-- silently regenerated on later edits — see the trigger below.

-- ─── slug column ────────────────────────────────────────────────────────────
alter table public.artists
  add column if not exists slug text;

-- ─── slug history (for permanent redirects when a slug is deliberately changed) ──
create table if not exists public.artist_slug_history (
  slug text primary key,
  artist_id uuid not null references public.artists(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.artist_slug_history enable row level security;

-- Publicly readable (it only maps old-slug -> artist id, no private data)
-- so the profile route can resolve an old link to a redirect without
-- needing an authenticated session.
create policy "Slug history is publicly readable"
  on public.artist_slug_history for select
  using (true);

-- ─── slug generation ────────────────────────────────────────────────────────
-- Slugifies a name and guarantees uniqueness against both live artist slugs
-- and retired ones in the history table (so an old, redirected slug can
-- never be reissued to a different artist).
create or replace function public.generate_unique_artist_slug(p_source text, p_artist_id uuid)
returns text
language plpgsql
as $$
declare
  base_slug text;
  candidate text;
  suffix int := 1;
begin
  base_slug := lower(trim(regexp_replace(coalesce(p_source, ''), '[^a-zA-Z0-9]+', '-', 'g'), '-'));
  if base_slug is null or base_slug = '' then
    base_slug := 'artist';
  end if;

  candidate := base_slug;
  loop
    if not exists (
      select 1 from public.artists where slug = candidate and id <> p_artist_id
    ) and not exists (
      select 1 from public.artist_slug_history where slug = candidate and artist_id <> p_artist_id
    ) then
      return candidate;
    end if;
    suffix := suffix + 1;
    candidate := base_slug || '-' || suffix;
  end loop;
end;
$$;

-- Generates the slug once on first insert. Deliberately does NOT
-- regenerate the slug on every update — editing name, category, location,
-- price, or bio must never change the public URL. A slug can only change
-- if a future admin/artist tool explicitly sets a new, non-empty `slug`
-- value different from the current one, in which case the old slug is
-- archived to artist_slug_history for a permanent redirect.
create or replace function public.handle_artist_slug()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.slug is null or new.slug = '' then
      new.slug := public.generate_unique_artist_slug(coalesce(nullif(new.stage_name, ''), new.full_name), new.id);
    end if;
    return new;
  end if;

  -- UPDATE
  if old.slug is null or old.slug = '' then
    new.slug := public.generate_unique_artist_slug(coalesce(nullif(new.stage_name, ''), new.full_name), new.id);
  elsif new.slug is distinct from old.slug and new.slug is not null and new.slug <> '' then
    insert into public.artist_slug_history (slug, artist_id) values (old.slug, old.id)
    on conflict (slug) do nothing;
    new.slug := public.generate_unique_artist_slug(new.slug, new.id);
  else
    new.slug := old.slug;
  end if;
  return new;
end;
$$;

drop trigger if exists artists_handle_slug on public.artists;
create trigger artists_handle_slug
  before insert or update on public.artists
  for each row execute function public.handle_artist_slug();

-- Backfill existing rows that don't have a slug yet (safe, idempotent —
-- only touches rows where slug is currently null). Note: if two existing
-- artists share the exact same name and both currently have a null slug,
-- this single-statement backfill could assign them the same candidate
-- (each row's uniqueness check runs against the pre-statement snapshot).
-- The unique constraint below will then fail loudly rather than silently
-- create a collision — if that happens, rename one artist's stage/full
-- name slightly and re-run this block.
update public.artists
set slug = public.generate_unique_artist_slug(coalesce(nullif(stage_name, ''), full_name), id)
where slug is null or slug = '';

alter table public.artists
  add constraint artists_slug_unique unique (slug);
-- (the unique constraint above already creates a supporting index — no separate index needed)

-- ─── expose slug through the public-safe view ───────────────────────────────
-- CREATE OR REPLACE VIEW can only append new columns at the end, not insert
-- one in the middle of the existing list — so this drops and recreates the
-- view instead, and re-grants access (a fresh view has no grants of its own).
drop view if exists public.artists_public;

create view public.artists_public as
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
  created_at, updated_at,
  slug
from public.artists
where status = 'published';

grant select on public.artists_public to anon, authenticated;
