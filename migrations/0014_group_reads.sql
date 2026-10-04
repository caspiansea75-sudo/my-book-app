-- How far each member has read in the group chat (for the "seen by" avatars).
create table if not exists chat_group_reads (
  member_id    integer primary key references members(id) on delete cascade,
  last_read_id integer not null default 0,
  updated_at   timestamptz not null default now()
);
