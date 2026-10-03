-- Manual 18+ mark for stories ("book") and manga series ("manga").
-- No row = the default: new stories and new manga are NOT 18+. (Old bundled stories that
-- already carry flagged paragraphs keep their 18+ label until someone sets it by hand.)

create table if not exists adult_flags (
  kind   text    not null check (kind in ('book', 'manga')),
  key    text    not null,
  adult  boolean not null,
  primary key (kind, key)
);
