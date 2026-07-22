-- Run this in the Supabase SQL Editor AFTER schema_v7.sql.
--
-- Phase 14 (final security audit) hardening. Two concrete gaps found during
-- the audit, fixed here rather than just documented:

-- 1. The enquiries UPDATE policy (schema_v2.sql) is scoped to
--    "auth.uid() = artist_id" with no column restriction, so an artist could
--    technically rewrite the client's own event_type/location/message text,
--    not just the status field it was meant for. This trigger pins every
--    column except status (and the timestamps the status-change trigger
--    manages) back to its original value on update, regardless of who's
--    making the request.
create or replace function public.protect_enquiry_immutable_fields()
returns trigger
language plpgsql
as $$
begin
  new.artist_id := old.artist_id;
  new.client_id := old.client_id;
  new.event_type := old.event_type;
  new.event_date := old.event_date;
  new.location := old.location;
  new.message := old.message;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists enquiries_protect_immutable_fields on public.enquiries;
create trigger enquiries_protect_immutable_fields
  before update on public.enquiries
  for each row execute function public.protect_enquiry_immutable_fields();

-- 2. The chat-attachments bucket (schema_v7.sql) had no file size or MIME
--    type restriction, allowing arbitrarily large or arbitrary-type
--    uploads. Cap it to 10MB and a safe allow-list of common chat
--    attachment types.
update storage.buckets
set file_size_limit = 10485760, -- 10MB
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf'
    ]
where id = 'chat-attachments';
