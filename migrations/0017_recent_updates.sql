-- "Recently updated" ordering: when did a chapter become readable (published)?
alter table library_chapters add column if not exists published_at timestamptz;
update library_chapters set published_at = created_at where published_at is null and status = 'published';
