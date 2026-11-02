-- Run once in Supabase → SQL Editor → New query → Run.
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

do $$
declare t text;
begin
  foreach t in array array['projects', 'tasks', 'shifts', 'fp_tests'] loop
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
