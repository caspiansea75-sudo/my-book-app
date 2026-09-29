-- Profiles, direct messages, the group chat and private chat pictures.
-- Chat pictures live in their own table (not in `media`) so they never show up
-- in the public gallery; they are only served to signed-in members who are
-- allowed to see them (see src/routes/api/chat-image.$id.ts).

create table if not exists chat_images (
  id         serial primary key,
  owner_id   integer not null references members(id) on delete cascade,
  mime       text not null default 'image/jpeg',
  data       text not null,
  bytes      integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists chat_images_owner_idx on chat_images (owner_id);

alter table members add column if not exists bio text not null default '';
alter table members add column if not exists avatar_id integer references chat_images(id) on delete set null;

-- recipient_id is null for the group chat, otherwise it is a direct message.
create table if not exists chat_messages (
  id           serial primary key,
  sender_id    integer not null references members(id) on delete cascade,
  recipient_id integer references members(id) on delete cascade,
  body         text not null default '',
  image_id     integer references chat_images(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists chat_messages_group_idx on chat_messages (id) where recipient_id is null;
create index if not exists chat_messages_dm_idx on chat_messages (sender_id, recipient_id, id);
create index if not exists chat_messages_inbox_idx on chat_messages (recipient_id, sender_id, id);
create index if not exists chat_messages_image_idx on chat_messages (image_id);

-- How far each member has read in each direct conversation (for unread counts).
create table if not exists chat_reads (
  member_id    integer not null references members(id) on delete cascade,
  peer_id      integer not null references members(id) on delete cascade,
  last_read_id integer not null default 0,
  primary key (member_id, peer_id)
);
