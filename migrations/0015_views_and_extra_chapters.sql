-- 1) Story / manga views: one row per member, per chapter, per day (so a refresh does not count twice).
create table if not exists content_views (
  member_id integer not null references members(id) on delete cascade,
  kind      text    not null,
  target    text    not null,
  day       date    not null default current_date,
  primary key (member_id, kind, target, day)
);
create index if not exists content_views_target_idx on content_views (kind, target);

-- 2) Extra chapters for the original (GitHub) stories live in a hidden "companion" book row.
--    extends_slug = the original story's slug.
alter table library_books add column if not exists extends_slug text;
create unique index if not exists library_books_extends_idx on library_books (extends_slug) where extends_slug is not null;
