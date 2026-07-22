-- Run this in the Supabase SQL Editor AFTER schema_v6.sql.
--
-- Phase 7 (chat attachments storage) and Phase 9 (contact-leak detection)
-- of the private client-artist communication system.

-- ─── Private chat attachments bucket ───────────────────────────────────────
-- Unlike artist-media (fully public), this bucket has no public read policy.
-- Files are stored under `${conversation_id}/${filename}` and are only
-- readable/writable by the two participants of that conversation, checked
-- against the conversations table itself — not by folder ownership like
-- artist-media, since a conversation is shared by two different users.
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', false)
on conflict (id) do nothing;

create policy "Participants can read attachments in their conversation"
  on storage.objects for select
  using (
    bucket_id = 'chat-attachments'
    and exists (
      select 1 from public.conversations c
      where c.id::text = (storage.foldername(name))[1]
        and (c.artist_id = auth.uid() or c.client_id = auth.uid())
    )
  );

create policy "Participants can upload attachments while active"
  on storage.objects for insert
  with check (
    bucket_id = 'chat-attachments'
    and exists (
      select 1 from public.conversations c
      where c.id::text = (storage.foldername(name))[1]
        and c.status = 'active'
        and (c.artist_id = auth.uid() or c.client_id = auth.uid())
    )
  );

-- ─── Contact-leak detection (warn, never block or alter) ───────────────────
-- Flags messages whose body looks like it contains a phone number or email
-- address. This never rejects or rewrites the message — it only sets a
-- flag the UI uses to show a gentle warning banner, matching the product
-- requirement to warn without over-blocking ordinary text (dates, prices).
create or replace function public.detect_contact_leak()
returns trigger
language plpgsql
as $$
begin
  if new.body ~ '(?:\+?\d[\s.-]?){9,}'
     or new.body ~* '[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\])\s*[a-z0-9.-]+\s*(?:\.|\(dot\)|\[dot\])\s*[a-z]{2,}'
  then
    new.flagged_contact_leak = true;
  end if;
  return new;
end;
$$;

drop trigger if exists messages_detect_contact_leak on public.messages;
create trigger messages_detect_contact_leak
  before insert on public.messages
  for each row execute function public.detect_contact_leak();

-- ─── Conversation partner lookup ────────────────────────────────────────────
-- Clients are owner-select-only (see schema.sql), so an artist has no way
-- to read a client's name for the chat header. Rather than loosening
-- clients' RLS, this SECURITY DEFINER function returns only the other
-- participant's display name/photo, and only to someone who is actually a
-- participant in that specific conversation.
create or replace function public.get_conversation_partner(p_conversation_id uuid)
returns table (user_id uuid, display_name text, profile_picture_url text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_artist_id uuid;
  v_client_id uuid;
begin
  select c.artist_id, c.client_id into v_artist_id, v_client_id
  from public.conversations c
  where c.id = p_conversation_id
    and (c.artist_id = auth.uid() or c.client_id = auth.uid());

  if v_artist_id is null then
    return;
  end if;

  if auth.uid() = v_artist_id then
    return query
      select cl.id, cl.full_name, ''::text
      from public.clients cl where cl.id = v_client_id;
  else
    return query
      select a.id, coalesce(nullif(a.stage_name, ''), a.full_name), a.profile_picture_url
      from public.artists a where a.id = v_artist_id;
  end if;
end;
$$;

revoke all on function public.get_conversation_partner(uuid) from public;
grant execute on function public.get_conversation_partner(uuid) to authenticated;
