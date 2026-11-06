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

-- A reminder (task) can point to one note; a note can have several reminders. Deleting the note keeps the reminders.
alter table public.tasks add column if not exists note_id uuid references public.notes on delete set null;

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
  foreach t in array array['projects', 'tasks', 'shifts', 'fp_tests', 'notes', 'daily_tasks', 'push_subscriptions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s: own" on public.%1$I', t);
    execute format('create policy "%1$s: own" on public.%1$I for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

create index if not exists tasks_user_status on public.tasks (user_id, status);

-- Daily counter for the AI (api/capture.ts), same as Músculo. No policies: only the function touches it.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;

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
