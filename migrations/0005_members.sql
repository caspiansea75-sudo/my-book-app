-- Members (username + password), sessions, and who created what.
-- owner_id is nullable on purpose: content that existed before accounts
-- (owner_id is null) can only be changed by the admin.

create table if not exists members (
  id            serial primary key,
  username      text not null unique,
  display_name  text not null,
  password_hash text not null,
  role          text not null default 'member',
  created_at    timestamptz not null default now()
);

create table if not exists member_sessions (
  token_hash text primary key,
  member_id  integer not null references members(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists member_sessions_member_idx on member_sessions (member_id);

alter table library_books add column if not exists owner_id integer references members(id) on delete set null;
alter table manga_series  add column if not exists owner_id integer references members(id) on delete set null;
alter table media         add column if not exists owner_id integer references members(id) on delete set null;
alter table media_folders add column if not exists owner_id integer references members(id) on delete set null;
