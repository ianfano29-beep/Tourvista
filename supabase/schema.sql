create table saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  place_id text not null, name text not null, category text not null,
  data jsonb not null, created_at timestamptz default now(),
  unique (user_id, place_id)
);
create table recent_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  country text, region text, city text, category text, created_at timestamptz default now()
);
create table trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null, created_at timestamptz default now()
);
create table trip_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips on delete cascade,
  place_id text not null, day int not null default 1, position int not null default 0, data jsonb not null
);

alter table saved_places enable row level security;
alter table recent_searches enable row level security;
alter table trips enable row level security;
alter table trip_items enable row level security;

create policy "own rows" on saved_places for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on recent_searches for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on trips for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on trip_items for all
  using (exists (select 1 from trips t where t.id = trip_id and t.user_id = auth.uid()))
  with check (exists (select 1 from trips t where t.id = trip_id and t.user_id = auth.uid()));
