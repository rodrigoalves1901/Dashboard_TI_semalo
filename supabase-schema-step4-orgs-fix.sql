-- 1) Garante SELECT para o dono da organização
alter table public.orgs enable row level security;

drop policy if exists "orgs_select_owner" on public.orgs;
create policy "orgs_select_owner"
  on public.orgs
  for select
  to authenticated
  using (owner_id = auth.uid());

-- (Opcional) permitir UPDATE/DELETE pelo dono — mantém consistência
drop policy if exists "orgs_update_owner" on public.orgs;
create policy "orgs_update_owner"
  on public.orgs
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "orgs_delete_owner" on public.orgs;
create policy "orgs_delete_owner"
  on public.orgs
  for delete
  to authenticated
  using (owner_id = auth.uid());

-- 2) Deduplica orgs com mesmo (owner_id, name) mantendo a mais antiga
with ranked as (
  select id,
         row_number() over (partition by owner_id, name order by created_at asc) as rn
  from public.orgs
)
delete from public.orgs o
using ranked r
where o.id = r.id and r.rn > 1;

-- 3) Evita duplicatas futuras
create unique index if not exists orgs_owner_name_uniq
  on public.orgs (owner_id, name);
