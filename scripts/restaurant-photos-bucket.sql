-- Public storage bucket for merchant-uploaded restaurant hero photos.
--
-- Public read: diners (and anon visitors on /browse, /r/[id]) load the
-- photo directly from the public URL. Writes happen ONLY through the
-- service-role client in the upload server action (see
-- src/app/dashboard/settings/actions.ts), which bypasses storage RLS —
-- so no per-object insert/update policy is needed.
--
-- Idempotent. Apply with: npm run setup:restaurant-photos

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'restaurant-photos',
  'restaurant-photos',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
