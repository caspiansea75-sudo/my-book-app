-- Personal literary library: books, chapters, and uploaded media.
-- Unowned rows (auth off). No bulk wipe mutations in the app.

create table if not exists media (
  id          serial primary key,
  kind        text not null check (kind in ('image', 'video')),
  title       text not null default '',
  mime        text not null default 'application/octet-stream',
  source      text not null check (source in ('upload', 'url')),
  url         text,
  data        text,
  thumb       text,
  width       integer,
  height      integer,
  bytes       integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists media_created_at_idx on media (created_at desc);
create index if not exists media_kind_idx on media (kind);

create table if not exists library_books (
  id              serial primary key,
  slug            text not null unique,
  title           text not null,
  title_en        text not null default '',
  author          text not null default '',
  tagline         text not null default '',
  description     text not null default '',
  cover_media_id  integer references media(id) on delete set null,
  created_at      timestamptz not null default now()
);

create table if not exists library_chapters (
  id          serial primary key,
  book_id     integer not null references library_books(id) on delete cascade,
  slug        text not null,
  title       text not null,
  title_en    text not null default '',
  excerpt     text not null default '',
  sort_order  integer not null default 0,
  body        jsonb not null default '{"sections":[]}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (book_id, slug)
);

create index if not exists library_chapters_book_idx on library_chapters (book_id, sort_order);

create table if not exists book_covers (
  book_slug  text primary key,
  media_id   integer not null references media(id) on delete cascade
);

create table if not exists chapter_inserts (
  id              serial primary key,
  book_slug       text not null,
  chapter_slug    text not null,
  after_para_id   text not null default '',
  media_id        integer not null references media(id) on delete cascade,
  caption         text not null default '',
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists chapter_inserts_chapter_idx
  on chapter_inserts (book_slug, chapter_slug, sort_order);
