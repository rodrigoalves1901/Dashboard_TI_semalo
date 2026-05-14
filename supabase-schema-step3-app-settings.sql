-- App-wide settings (singleton row id=1)
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  system_name text not null default 'DigitalDash',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

-- Seed singleton row
insert into public.app_settings (id, system_name)
values (1, 'DigitalDash')
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

-- Public read (so login/signup pages can show the brand before sign-in)
drop policy if exists "app_settings_select_all" on public.app_settings;
create policy "app_settings_select_all"
  on public.app_settings
  for select
  using (true);

-- Any authenticated user can rename the system (tighten later with a role)
drop policy if exists "app_settings_update_authenticated" on public.app_settings;
create policy "app_settings_update_authenticated"
  on public.app_settings
  for update
  to authenticated
  using (true)
  with check (true);
