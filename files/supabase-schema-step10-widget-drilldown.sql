-- Adiciona coluna `drilldown` (jsonb) à tabela widgets para guardar a ação de
-- clique em cada widget. Formato:
--   { "type": "table", "title": "...", "connectionId": "uuid|null", "sql": "SELECT ..." }
--   { "type": "dashboard", "dashboardId": "uuid" }
-- Rode no SQL Editor do Lovable Cloud.

alter table public.widgets
  add column if not exists drilldown jsonb;
