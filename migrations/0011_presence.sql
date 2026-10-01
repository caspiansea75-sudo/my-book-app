-- Online / offline status: the time each member's open browser tab last checked in.
alter table members add column if not exists last_seen_at timestamptz;
