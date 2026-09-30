-- Likes and comments on story chapters and manga chapters.
-- kind   = 'story' | 'manga'
-- target = '<book or series slug>:<chapter slug>'
-- Keyed by text (not a foreign key) because the original stories live in JSON
-- files rather than in the database.

create table if not exists content_likes (
  member_id  integer not null references members(id) on delete cascade,
  kind       text not null,
  target     text not null,
  created_at timestamptz not null default now(),
  primary key (member_id, kind, target)
);
create index if not exists content_likes_target_idx on content_likes (kind, target);

create table if not exists content_comments (
  id         serial primary key,
  member_id  integer not null references members(id) on delete cascade,
  kind       text not null,
  target     text not null,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists content_comments_target_idx on content_comments (kind, target, id);
create index if not exists content_comments_member_idx on content_comments (member_id);
