-- Media folders: nestable folders for organising rows of `media`.
-- Membership lives in its own table, so `media` itself is untouched.
-- A media item sits in at most one folder; no row = "unfiled" (home).
-- Deleting a folder never deletes media (membership rows only).

create table if not exists media_folders (
  id          serial primary key,
  parent_id   integer references media_folders(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists media_folders_parent_idx on media_folders (parent_id);

create table if not exists media_folder_items (
  media_id   integer primary key references media(id) on delete cascade,
  folder_id  integer not null references media_folders(id) on delete cascade,
  added_at   timestamptz not null default now()
);

create index if not exists media_folder_items_folder_idx on media_folder_items (folder_id);
