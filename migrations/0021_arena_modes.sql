-- Arena Brawl online: co-op survival rooms, and 3-round matches for the battle royale.
alter table arena_rooms add column if not exists mode text not null default 'royale';      -- royale | coop
alter table arena_rooms add column if not exists rounds integer not null default 3;
alter table arena_rooms add column if not exists cur_round integer not null default 1;
alter table arena_rooms add column if not exists reported_round integer not null default 0; -- the last `round` whose result was recorded
alter table arena_room_players add column if not exists points integer not null default 0;
alter table arena_room_players add column if not exists wins integer not null default 0;
alter table arena_room_players add column if not exists kos integer not null default 0;
