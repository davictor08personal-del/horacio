-- Run once in Supabase → SQL Editor → New query → Run. Safe to run again (e.g. after adding notes).
-- Every table has user_id and Row Level Security: each row is only visible to its owner.
-- The publishable key travels in the app, so these rules are what actually protect the data.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  status text not null default 'activo' check (status in ('activo', 'pausado', 'hecho')),
  next_step text,
  area text,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  notes text,
  status text not null default 'abierto' check (status in ('abierto', 'en_curso', 'esperando', 'hecho', 'descartado')),
  priority text not null default 'media' check (priority in ('alta', 'media', 'baja')),
  effort text not null default 'medio' check (effort in ('rapido', 'medio', 'grande')),
  due_date date,
  due_time time,
  area text,
  project_id uuid references public.projects on delete set null,
  created_at timestamptz not null default now(),
  done_at timestamptz
);

-- Notes (Keep-style: colour, pinned, archived, optional checklist in `items`).
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null default '',
  body text not null default '',
  items jsonb, -- [{ "text": "...", "done": false }] when the note is a checklist
  color text not null default 'none' check (color in ('none', 'rojo', 'naranja', 'amarillo', 'verde', 'azul', 'morado')),
  pinned boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A short description, shown at the top of the project's page.
alter table public.projects add column if not exists description text;
-- Its icon: an emoji, or a small picture as a data: URL (160 px, made in the phone; see src/media.ts).
alter table public.projects add column if not exists icon text;
-- Tags (#idiomas, #salud…): one tag can be on many projects, and #tag in a search box finds the projects,
-- notes and tasks under it. Stored clean (lowercase, no accents, no #), see cleanTag in src/logic.ts.
alter table public.projects add column if not exists tags text[] not null default '{}';
alter table public.projects drop constraint if exists projects_tags;
alter table public.projects add constraint projects_tags check (cardinality(tags) <= 10) not valid;

alter table public.notes add column if not exists project_id uuid references public.projects on delete set null;

-- Things to do every day. Ticked = done_on is today, so tomorrow they come back unticked by themselves.
create table if not exists public.daily_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  position int not null default 0,
  done_on date,
  created_at timestamptz not null default now()
);

-- A daily task can belong to a project (a label on Hoy; listed on the project's page).
alter table public.daily_tasks add column if not exists project_id uuid references public.projects on delete set null;

-- A daily task's own page: picture or emoji, a description and an optional note (shown in Notas and in its project).
alter table public.daily_tasks add column if not exists description text;
alter table public.daily_tasks add column if not exists icon text;
alter table public.daily_tasks add column if not exists note_id uuid references public.notes on delete set null;
-- Its colour on Hoy (solid tile, white text); 'none' = the normal card. Names in DAILY_COLORS (src/types.ts).
alter table public.daily_tasks add column if not exists color text not null default 'none';
alter table public.daily_tasks drop constraint if exists daily_tasks_color;
alter table public.daily_tasks add constraint daily_tasks_color check (char_length(color) <= 20) not valid;

-- Every day a daily task was done: the weekly streaks are counted from here (done_on only knows today).
create table if not exists public.daily_log (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  daily_id uuid not null references public.daily_tasks on delete cascade,
  day date not null,
  primary key (daily_id, day)
);
-- The days already ticked before the log existed.
insert into public.daily_log (user_id, daily_id, day)
  select user_id, id, done_on from public.daily_tasks where done_on is not null
  on conflict do nothing;

-- A reminder (task) can point to one note; a note can have several reminders. Deleting the note keeps the reminders.
alter table public.tasks add column if not exists note_id uuid references public.notes on delete set null;
-- Task and project colours (keys of DAILY_COLORS in src/types.ts).
alter table public.tasks add column if not exists color text not null default 'none';
alter table public.tasks drop constraint if exists tasks_color;
alter table public.tasks add constraint tasks_color check (char_length(color) <= 20) not valid;

-- Posponer: out of «Prioridades de hoy» until this day (a deadline is still due_date).
alter table public.tasks add column if not exists snoozed_until date;

alter table public.tasks add column if not exists tags text[] not null default '{}';
alter table public.tasks drop constraint if exists tasks_tags;
alter table public.tasks add constraint tasks_tags check (cardinality(tags) <= 10) not valid;

alter table public.projects add column if not exists color text not null default 'none';
alter table public.projects drop constraint if exists projects_color;
alter table public.projects add constraint projects_color check (char_length(color) <= 20) not valid;

-- Who the user is: their name (greeting), time zone (every «today» and notification time) and which optional
-- modules they use. Created by the welcome screen the first time they sign in.
create table if not exists public.profiles (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  name text check (char_length(name) <= 60),
  timezone text not null default 'Europe/Madrid',
  shifts boolean not null default false, -- «Turnos»: work shifts and the free time around them
  fp boolean not null default false,     -- «Estudios»: course tests by block
  created_at timestamptz not null default now()
);

-- One row per day; a new shift for the same day replaces the old one (upsert on user_id + day).
create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  kind text not null check (kind in ('opening', 'dia', 'noche', 'libre')),
  starts_at time,
  ends_at time,
  unique (user_id, day)
);

-- One row per unit test of the FP.
create table if not exists public.fp_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  subject text not null,
  block int,
  unit text not null,
  opens_on date,
  closes_on date,
  read boolean not null default false
);

-- Notifications (api/tick.ts). One row per phone or browser that allowed them.
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- When a reminder's notification went out. Changing its day or time clears it, so it rings again at the new time.
alter table public.tasks add column if not exists notified_at timestamptz;
create or replace function public.tasks_reset_notified() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.due_date is distinct from old.due_date or new.due_time is distinct from old.due_time then
    new.notified_at := null;
  end if;
  return new;
end $$;
drop trigger if exists tasks_reset_notified on public.tasks;
create trigger tasks_reset_notified before update on public.tasks
  for each row execute function public.tasks_reset_notified();

do $$
declare t text;
begin
  foreach t in array array['projects', 'tasks', 'shifts', 'fp_tests', 'notes', 'daily_tasks', 'push_subscriptions', 'daily_log', 'profiles'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s: own" on public.%1$I', t);
    execute format('create policy "%1$s: own" on public.%1$I for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

create index if not exists tasks_user_status on public.tasks (user_id, status);

-- Daily counter for the AI (api/capture.ts), same as Músculo. Users may read their own count; only the function writes.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
drop policy if exists "ai_usage: own select" on public.ai_usage;
create policy "ai_usage: own select" on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.ai_hit() returns int
language sql security definer set search_path = '' as $$
  insert into public.ai_usage (user_id, day, count) values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count;
$$;
revoke execute on function public.ai_hit() from public, anon;
grant execute on function public.ai_hit() to authenticated;

-- Which day's 9:30 summary each user already got (api/tick.ts). No policies: only the server (secret key) touches it.
create table if not exists public.push_daily (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  primary key (user_id, day)
);
alter table public.push_daily enable row level security;

-- Size limits, so nobody can store megabytes in one row (the app never gets near them). «not valid» = only new
-- and changed rows are checked. Pictures are ~10 KB data: URLs, so 60 000 characters leaves plenty of room.
do $$
begin
  alter table public.tasks drop constraint if exists tasks_sizes;
  alter table public.tasks add constraint tasks_sizes
    check (char_length(title) <= 500 and char_length(coalesce(notes, '')) <= 10000 and char_length(coalesce(area, '')) <= 100) not valid;
  alter table public.notes drop constraint if exists notes_sizes;
  alter table public.notes add constraint notes_sizes
    check (char_length(title) <= 500 and char_length(body) <= 50000 and octet_length(coalesce(items::text, '')) <= 50000) not valid;
  alter table public.projects drop constraint if exists projects_sizes;
  alter table public.projects add constraint projects_sizes
    check (char_length(name) <= 200 and char_length(coalesce(description, '')) <= 2000 and char_length(coalesce(next_step, '')) <= 1000
      and char_length(coalesce(area, '')) <= 100 and char_length(coalesce(icon, '')) <= 60000) not valid;
  alter table public.daily_tasks drop constraint if exists daily_tasks_sizes;
  alter table public.daily_tasks add constraint daily_tasks_sizes
    check (char_length(title) <= 200 and char_length(coalesce(description, '')) <= 2000 and char_length(coalesce(icon, '')) <= 60000) not valid;
  alter table public.fp_tests drop constraint if exists fp_tests_sizes;
  alter table public.fp_tests add constraint fp_tests_sizes
    check (char_length(subject) <= 200 and char_length(unit) <= 300) not valid;
  alter table public.push_subscriptions drop constraint if exists push_subscriptions_sizes;
  alter table public.push_subscriptions add constraint push_subscriptions_sizes
    check (char_length(endpoint) <= 2000 and char_length(p256dh) <= 200 and char_length(auth) <= 100) not valid;
  alter table public.profiles drop constraint if exists profiles_sizes;
  alter table public.profiles add constraint profiles_sizes
    check (char_length(timezone) <= 100) not valid;
end $$;

-- Pictures inside notes (see src/noteImages.ts). Private bucket, one folder per user («<user id>/<file>»);
-- 2 MB per file and only WebP/JPEG (the app shrinks them to ~200 KB in the phone first).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('note-images', 'note-images', false, 2097152, array['image/webp', 'image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "note-images: own select" on storage.objects;
create policy "note-images: own select" on storage.objects for select to authenticated
  using (bucket_id = 'note-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "note-images: own insert" on storage.objects;
create policy "note-images: own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'note-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "note-images: own delete" on storage.objects;
create policy "note-images: own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'note-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

notify pgrst, 'reload schema';
