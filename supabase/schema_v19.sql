-- Run this in the Supabase SQL Editor AFTER schema_v18.sql.
--
-- Artists browsing open jobs currently only see title/description — the
-- posting client's name is invisible because public.clients is owner-only
-- readable (schema.sql: `using (auth.uid() = id)`). This view exposes just
-- the client's display name (never phone/email) alongside open jobs, the
-- same "public-safe view" pattern already used for artists_public —
-- created by the table-owning role, so it can read across clients'
-- RLS-restricted rows while only ever returning the one column chosen here.
create or replace view public.jobs_open as
select
  j.id, j.client_id, j.title, j.art_form, j.event_type, j.city, j.state,
  j.event_date, j.date_flexible, j.budget_min, j.budget_max, j.description,
  j.status, j.created_at, j.updated_at,
  coalesce(nullif(c.full_name, ''), 'A client') as client_name
from public.jobs j
join public.clients c on c.id = j.client_id
where j.status = 'open';

grant select on public.jobs_open to authenticated;
