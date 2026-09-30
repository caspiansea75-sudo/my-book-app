-- Chat: replies, forwarded messages, pins, emoji reactions and reports.

-- reply_to_id is deliberately NOT a foreign key: when the original message is
-- deleted, the reply stays and shows "the original message was deleted".
alter table chat_messages add column if not exists reply_to_id integer;
alter table chat_messages add column if not exists forwarded boolean not null default false;
alter table chat_messages add column if not exists pinned_at timestamptz;
alter table chat_messages add column if not exists pinned_by integer references members(id) on delete set null;
create index if not exists chat_messages_pinned_idx on chat_messages (pinned_at) where pinned_at is not null;

-- One reaction per member per message (picking another emoji replaces it).
create table if not exists chat_reactions (
  message_id integer not null references chat_messages(id) on delete cascade,
  member_id  integer not null references members(id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, member_id)
);
create index if not exists chat_reactions_message_idx on chat_reactions (message_id);

create table if not exists chat_reports (
  id          serial primary key,
  message_id  integer not null references chat_messages(id) on delete cascade,
  reporter_id integer not null references members(id) on delete cascade,
  reason      text not null default '',
  created_at  timestamptz not null default now(),
  unique (message_id, reporter_id)
);
create index if not exists chat_reports_message_idx on chat_reports (message_id);
