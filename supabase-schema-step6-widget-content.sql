-- Adiciona suporte a widgets do tipo "markdown" (texto rico) e "divider" (divisória).
-- Rode no SQL Editor do Lovable Cloud.

-- 1) Coluna de conteúdo livre (markdown)
alter table public.widgets
  add column if not exists content text;

-- 2) preset deixa de ser obrigatório (markdown/divider não usam)
alter table public.widgets
  alter column preset drop not null;

-- 3) Atualiza CHECK de chart_type para aceitar os novos tipos
do $$
declare
  c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'public.widgets'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%chart_type%';
  if c is not null then
    execute format('alter table public.widgets drop constraint %I', c);
  end if;
end$$;

alter table public.widgets
  add constraint widgets_chart_type_check
  check (chart_type in ('metric','bar','line','donut','table','markdown','divider'));
