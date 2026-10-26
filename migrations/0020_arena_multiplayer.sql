-- Arena Brawl multiplayer: lobby rooms (2-5 members), who is in them, and the WebRTC signaling relay.
create table if not exists arena_rooms (
  id          serial primary key,
  host_id     integer not null references members(id) on delete cascade,
  max_players integer not null default 4 check (max_players between 2 and 5),
  status      text not null default 'open',      -- open | playing | done
  round       integer not null default 1,        -- bumped on every rematch (new signaling room)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists arena_rooms_open_idx on arena_rooms (status, updated_at desc);

create table if not exists arena_room_players (
  room_id    integer not null references arena_rooms(id) on delete cascade,
  member_id  integer not null references members(id) on delete cascade,
  species    text not null default 'charizard',
  gimmick    text not null default 'awaken',
  mega       text not null default '',
  tera       text not null default '',
  joined_at  timestamptz not null default now(),
  seen_at    timestamptz not null default now(),
  primary key (room_id, member_id)
);

create table if not exists rtc_peers (
  room     text not null,
  peer     text not null,
  name     text not null default '',
  seen_at  timestamptz not null default now(),
  primary key (room, peer)
);

create table if not exists rtc_signals (
  id         bigserial primary key,
  room       text not null,
  from_peer  text not null,
  to_peer    text not null,
  kind       text not null,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists rtc_signals_to_idx on rtc_signals (room, to_peer, id);
