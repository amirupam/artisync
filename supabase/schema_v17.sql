-- Run this in the Supabase SQL Editor AFTER schema_v16.sql.
--
-- Either participant can reopen a conversation they (or the other side)
-- closed. The existing UPDATE policies on conversations require the row's
-- CURRENT status to already be 'active' before allowing any update at all
-- (schema_v7.sql: `using (... and status = 'active')`), which was fine for
-- closing but makes reopening impossible via a plain UPDATE — RLS blocks
-- it before the with-check even runs. A SECURITY DEFINER function is the
-- clean way to allow this one specific transition without loosening RLS.
-- `blocked` is deliberately excluded — blocking stays permanent.
create or replace function public.reopen_conversation(p_conversation_id uuid)
returns public.conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation public.conversations;
begin
  select * into v_conversation from public.conversations
  where id = p_conversation_id
    and (artist_id = auth.uid() or client_id = auth.uid());

  if not found then
    raise exception 'Conversation not found';
  end if;

  if v_conversation.status not in ('closed_by_artist', 'closed_by_client') then
    return v_conversation;
  end if;

  update public.conversations set status = 'active' where id = p_conversation_id
    returning * into v_conversation;

  return v_conversation;
end;
$$;

revoke all on function public.reopen_conversation(uuid) from public;
grant execute on function public.reopen_conversation(uuid) to authenticated;
