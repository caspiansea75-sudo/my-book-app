-- Arena Brawl online: Team Battle 3v3 needs rooms of up to 6 players, and there are two new room modes.
alter table arena_rooms drop constraint if exists arena_rooms_max_players_check;
alter table arena_rooms add constraint arena_rooms_max_players_check check (max_players between 2 and 6);
-- mode is plain text: royale | coop | team | quick
