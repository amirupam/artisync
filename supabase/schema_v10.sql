-- Run this in the Supabase SQL Editor AFTER schema_v9.sql.
--
-- Phase 14 (profile quality / publishing rules) of the discoverability work.
--
-- The existing completeness check (lib/artistProfileCompleteness.ts) looks
-- at phone/email as a "has a contact method" signal. But the public-facing
-- artists_public view deliberately excludes phone/email (schema_v6/v9) —
-- so running that same check against public data would make EVERY profile
-- look incomplete, even genuinely complete ones. The fix: compute the
-- "good enough to index" decision inside Postgres, where the full private
-- row (including phone/email) is available, and expose only the resulting
-- boolean through the public view — never the private fields themselves.

create or replace function public.artist_is_indexable(a public.artists)
returns boolean
language sql
stable
as $$
  select
    (nullif(a.full_name, '') is not null or nullif(a.stage_name, '') is not null)
    and nullif(a.profile_picture_url, '') is not null
    and nullif(a.bio, '') is not null
    and nullif(a.city, '') is not null
    and nullif(a.state, '') is not null
    and nullif(a.art_form, '') is not null
    and (cardinality(a.art_sub_forms) > 0 or cardinality(a.skills) > 0)
    and (cardinality(a.performance_image_urls) > 0 or cardinality(a.youtube_videos) > 0)
    and (nullif(a.phone, '') is not null or nullif(a.email, '') is not null)
$$;

-- Append-only: adds is_indexable at the end of the existing column list.
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
  created_at, updated_at,
  slug,
  artist_is_indexable(artists.*) as is_indexable
from public.artists
where status = 'published';
