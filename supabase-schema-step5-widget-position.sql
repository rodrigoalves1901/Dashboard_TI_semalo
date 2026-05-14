-- Adiciona coluna `position` (jsonb) à tabela widgets para guardar layout do grid.
-- Formato: { "x": number, "y": number, "w": number, "h": number }
-- Rode no SQL Editor do Lovable Cloud.

alter table public.widgets
  add column if not exists position jsonb;

-- Índice opcional para consultas futuras
create index if not exists widgets_dashboard_id_idx
  on public.widgets (dashboard_id);
