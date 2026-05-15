-- Slideshows: playlists de dashboards para o modo apresentação.
-- Rode no SQL Editor do Lovable Cloud.

create table if not exists public.slideshows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  default_seconds int not null default 30,
  created_at timestamptz not null default now()
);

create table if not exists public.slideshow_items (
  id uuid primary key default gen_random_uuid(),
  slideshow_id uuid not null references public.slideshows(id) on delete cascade,
  dashboard_id uuid not null references public.dashboards(id) on delete cascade,
  position int not null,
  seconds int not null default 30
);

create index if not exists slideshow_items_slideshow_idx
  on public.slideshow_items(slideshow_id, position);

alter table public.slideshows enable row level security;
alter table public.slideshow_items enable row level security;

-- Membros da org podem tudo (mesmo padrão de dashboards/widgets).
drop policy if exists "slideshows_org_members" on public.slideshows;
create policy "slideshows_org_members"
  on public.slideshows for all
  using (
    exists (
      select 1 from public.orgs o
      where o.id = slideshows.org_id
        and o.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.orgs o
      where o.id = slideshows.org_id
        and o.owner_id = auth.uid()
    )
  );

drop policy if exists "slideshow_items_org_members" on public.slideshow_items;
create policy "slideshow_items_org_members"
  on public.slideshow_items for all
  using (
    exists (
      select 1 from public.slideshows s
      join public.orgs o on o.id = s.org_id
      where s.id = slideshow_items.slideshow_id
        and o.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.slideshows s
      join public.orgs o on o.id = s.org_id
      where s.id = slideshow_items.slideshow_id
        and o.owner_id = auth.uid()
    )
  );
