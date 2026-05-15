-- Adiciona escala do valor principal em widgets de métrica.
-- 1 = 100% (padrão). 2 = dobro. Aceita decimais (1.5, 2.25...).
-- Rode no SQL Editor do Lovable Cloud.

alter table public.widgets
  add column if not exists value_scale numeric not null default 1;

alter table public.widgets
  drop constraint if exists widgets_value_scale_check;

alter table public.widgets
  add constraint widgets_value_scale_check
  check (value_scale >= 0.5 and value_scale <= 6);
