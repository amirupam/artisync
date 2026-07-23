-- Run this in the Supabase SQL Editor AFTER schema_v11.sql.
--
-- Bugfix: none of the chat migrations ever added `messages` or
-- `conversations` to the `supabase_realtime` publication. Every
-- `.channel(...).on("postgres_changes", ...)` subscription in the frontend
-- (ChatThread, ChatContext) has therefore been silently inert — Postgres
-- was never told to broadcast changes on these tables over the replication
-- slot Realtime reads from. This is why new messages and unread counts
-- only ever showed up after a manual reload instead of live. `add table`
-- has no `if not exists` form, so this checks pg_publication_tables first
-- to stay safe to re-run.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'contact_share_requests'
  ) then
    alter publication supabase_realtime add table public.contact_share_requests;
  end if;
end $$;
