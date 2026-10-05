-- Locks: a member can lock their own pictures, videos and folders so other members cannot see them
-- in the gallery or pick them for their own stories/manga. Locking a folder locks everything inside it
-- (including sub-folders). The owner and the admin always see their locked things.
-- Pictures that are already shown inside a published story or manga keep showing to its readers.
alter table media         add column if not exists locked boolean not null default false;
alter table media_folders add column if not exists locked boolean not null default false;

create index if not exists media_locked_idx         on media (locked)         where locked;
create index if not exists media_folders_locked_idx on media_folders (locked) where locked;
