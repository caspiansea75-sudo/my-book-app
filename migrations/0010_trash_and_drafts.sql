-- Trash (soft delete) for books, chapters and images/videos, and draft/published chapters.
-- Nothing is removed from the database any more when someone presses "delete":
-- the row is only stamped with deleted_at and can be restored from the Trash.

alter table library_books    add column if not exists deleted_at timestamptz;
alter table library_books    add column if not exists deleted_by integer references members(id) on delete set null;
alter table library_chapters add column if not exists deleted_at timestamptz;
alter table library_chapters add column if not exists deleted_by integer references members(id) on delete set null;
alter table media            add column if not exists deleted_at timestamptz;
alter table media            add column if not exists deleted_by integer references members(id) on delete set null;

create index if not exists library_books_deleted_idx    on library_books (deleted_at)    where deleted_at is not null;
create index if not exists library_chapters_deleted_idx on library_chapters (deleted_at) where deleted_at is not null;
create index if not exists media_deleted_idx            on media (deleted_at)            where deleted_at is not null;

-- Existing chapters stay visible: they start as 'published'.
alter table library_chapters add column if not exists status text not null default 'published';
alter table library_chapters drop constraint if exists library_chapters_status_check;
alter table library_chapters add constraint library_chapters_status_check check (status in ('draft', 'published'));
