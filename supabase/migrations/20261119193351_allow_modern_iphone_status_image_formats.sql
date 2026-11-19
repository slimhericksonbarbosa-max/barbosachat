-- Accept native iPhone photo formats in the private status bucket.
update storage.buckets
set allowed_mime_types = (
  select array_agg(distinct mime_type order by mime_type)
  from unnest(
    coalesce(allowed_mime_types, array[]::text[])
    || array['image/heic','image/heif','image/avif']::text[]
  ) as mime_type
)
where id = 'status-media';
