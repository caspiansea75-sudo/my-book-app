-- Arena Brawl Team Battle: players choose their seat (slot 0,2,4 = Team A; 1,3,5 = Team B).
alter table arena_room_players add column if not exists slot integer;
