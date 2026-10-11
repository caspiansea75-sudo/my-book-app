-- Pokémon battles: saved teams and every battle (member vs member, or member vs CPU).
-- A battle is stored as its seed + the list of choices made so far ("rounds"); the real
-- Pokémon Showdown engine replays them to get to the current position, and the full log
-- is kept so any finished battle can be watched again.
create table if not exists poke_teams (
  id          serial primary key,
  owner_id    integer not null references members(id) on delete cascade,
  name        text not null,
  gen         integer not null default 9,
  sets        jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists poke_teams_owner_idx on poke_teams (owner_id);

create table if not exists poke_battles (
  id            serial primary key,
  p1_id         integer not null references members(id) on delete cascade,
  p2_id         integer references members(id) on delete cascade,   -- null = CPU
  cpu_level     text,                                               -- easy | normal | hard
  format        text not null,                                      -- e.g. gen9customgame
  gen           integer not null,
  status        text not null default 'active',                     -- invited | active | done | declined
  seed          jsonb not null,
  p1_name       text not null,
  p2_name       text not null,
  p1_team       text,                                               -- packed team
  p2_team       text,
  p1_sets       jsonb,                                              -- readable copy of the team
  p2_sets       jsonb,
  sprites       jsonb not null default '{}'::jsonb,                 -- species name -> sprite id, dex number, types
  moves         jsonb not null default '{}'::jsonb,                 -- move id -> name, type, category, power, accuracy
  rounds        jsonb not null default '[]'::jsonb,                 -- [[p1 choice, p2 choice], ...]
  pending       jsonb not null default '{}'::jsonb,                 -- a choice made while the other player still thinks
  log           jsonb not null default '[]'::jsonb,                 -- raw battle protocol lines
  requests      jsonb not null default '{}'::jsonb,                 -- what each side may do now
  turn          integer not null default 0,
  winner        text,                                               -- p1 | p2 | tie
  winner_id     integer,
  end_reason    text,                                               -- normal | forfeit | timeout
  p1_left       integer,
  p2_left       integer,
  rev           integer not null default 0,
  created_at    timestamptz not null default now(),
  last_move_at  timestamptz not null default now(),
  finished_at   timestamptz
);
create index if not exists poke_battles_p1_idx on poke_battles (p1_id, status);
create index if not exists poke_battles_p2_idx on poke_battles (p2_id, status);
create index if not exists poke_battles_done_idx on poke_battles (finished_at desc) where status = 'done';
