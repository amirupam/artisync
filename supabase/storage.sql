-- Run this AFTER schema.sql, in the same SQL Editor.
-- Creates one public bucket for all artist media (profile pics, cover banners, performance photos).

insert into storage.buckets (id, name, public)
values ('artist-media', 'artist-media', true)
on conflict (id) do nothing;

-- Anyone can view files (profile pictures etc. are shown on public artist pages).
create policy "Artist media is publicly readable"
  on storage.objects for select
  using (bucket_id = 'artist-media');

-- Authenticated users can only upload into a folder named after their own user id,
-- e.g. artist-media/<uid>/profile_123.jpg
create policy "Users can upload into their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'artist-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their own files"
  on storage.objects for update
  using (
    bucket_id = 'artist-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own files"
  on storage.objects for delete
  using (
    bucket_id = 'artist-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
