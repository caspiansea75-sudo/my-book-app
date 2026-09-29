-- Things the admin has hidden from members. One row = one hidden item.
-- kind: 'book' (story, key = slug) | 'manga' (key = slug) | 'media' (key = id)
create table if not exists hidden_items (
  kind       text not null,
  key        text not null,
  hidden_at  timestamptz not null default now(),
  primary key (kind, key)
);
