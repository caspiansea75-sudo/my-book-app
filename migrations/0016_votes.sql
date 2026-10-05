-- Reputation for a whole story or manga series: each member votes up (+1) or down (-1), once.
-- kind = 'story' | 'manga'; parent = the story / series slug.
create table if not exists content_votes (
  member_id  integer     not null references members(id) on delete cascade,
  kind       text        not null,
  parent     text        not null,
  value      smallint    not null check (value in (-1, 1)),
  updated_at timestamptz not null default now(),
  primary key (member_id, kind, parent)
);
create index if not exists content_votes_parent_idx on content_votes (kind, parent);
