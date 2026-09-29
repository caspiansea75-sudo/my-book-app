-- Writer names. Studio stories already have library_books.author; manga gets one too.
alter table manga_series add column if not exists author text not null default '';

-- Writer name for the original (GitHub JSON) stories, set from the site by the admin.
create table if not exists author_overrides (
  kind   text not null,
  key    text not null,
  author text not null,
  primary key (kind, key)
);
