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

-- Local curated places (manually added via Supabase dashboard, visible to all users)
create table local_places (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  lat           float8 not null,
  lng           float8 not null,
  image_url     text not null,
  reference_url text,
  description   text,
  category      text not null check (category in ('restaurants','hotels','tours','attractions','inspire','heritage')),
  address       text,
  tags          text[],
  rating        float4 default 0,
  city          text not null default 'General Santos City',
  created_at    timestamptz default now()
);

alter table local_places enable row level security;

-- Anyone (including unauthenticated visitors) can read local places
create policy "public read" on local_places for select using (true);

-- Authenticated users whose email is admin@gmail.com can insert / update / delete
-- NOTE: Run this in the Supabase SQL Editor after creating the admin account.
create policy "admin write" on local_places for all
  using    (auth.email() = 'admin@gmail.com')
  with check (auth.email() = 'admin@gmail.com');

-- Visitor Comments & Feedback for Local Curated Places
create table place_comments (
  id            uuid primary key default gen_random_uuid(),
  place_id      text not null,
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  user_email    text not null,
  rating        int not null default 5 check (rating >= 1 and rating <= 5),
  comment       text not null check (char_length(trim(comment)) > 0),
  created_at    timestamptz default now()
);

alter table place_comments enable row level security;

-- Public can view all comments on local places
create policy "public read comments" on place_comments for select using (true);

-- Only logged-in (authenticated) users can insert feedback
create policy "authenticated insert comments" on place_comments for insert
  with check (auth.uid() = user_id);

-- Users can delete their own comments if needed
create policy "own comments delete" on place_comments for delete
  using (auth.uid() = user_id);

