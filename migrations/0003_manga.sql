-- Manga: series made of ordered chapters, each an ordered sequence of
-- panels pointing at existing rows in `media`. No bulk wipe mutations.

create table if not exists manga_series (
  id               serial primary key,
  slug             text not null unique,
  title            text not null,
  title_en         text not null default '',
  description      text not null default '',
  cover_media_id   integer references media(id) on delete set null,
  created_at       timestamptz not null default now()
);

create table if not exists manga_chapters (
  id          serial primary key,
  series_id   integer not null references manga_series(id) on delete cascade,
  slug        text not null,
  title       text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (series_id, slug)
);

create index if not exists manga_chapters_series_idx on manga_chapters (series_id, sort_order);

create table if not exists manga_panels (
  id          serial primary key,
  chapter_id  integer not null references manga_chapters(id) on delete cascade,
  media_id    integer not null references media(id) on delete cascade,
  caption     text not null default '',
  sort_order  integer not null default 0
);

create index if not exists manga_panels_chapter_idx on manga_panels (chapter_id, sort_order);
