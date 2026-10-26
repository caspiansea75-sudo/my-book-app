-- Arena Brawl online: the four moves each member brought (comma separated move ids, empty = the Pokémon's own four).
alter table arena_room_players add column if not exists moves text not null default '';
