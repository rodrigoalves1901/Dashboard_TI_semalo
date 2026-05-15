## Drill-down ao clicar em um widget

Cada widget poderá ter uma **ação de clique** opcional, configurada no editor pelo ícone 🔍. Em todos os modos (dashboard, TV, Slideshow), clicar/tocar no card executa essa ação. No Slideshow o autoplay é pausado enquanto o overlay estiver aberto.

### 1. Modelo de dados

Nova coluna `drilldown` (jsonb, nullable) em `widgets`:

```json
// Tipo A — abrir planilha de detalhe
{
  "type": "table",
  "title": "Licenças ativas",
  "connectionId": "uuid-da-conexao",   // padrão: mesma conexão do widget
  "sql": "SELECT u.name, u.email, l.expires_at FROM licenses l JOIN users u ..."
}

// Tipo B — navegar para outro dashboard
{
  "type": "dashboard",
  "dashboardId": "uuid-do-dashboard"
}
```

Migration: `supabase-schema-step10-widget-drilldown.sql` (apenas `add column if not exists drilldown jsonb`).

Atualizar em `src/lib/data.ts`:
- Tipo `Widget` ganha `drilldown?: DrilldownConfig | null`.
- Mapper `mapWidget` lê a coluna.
- Nova função `updateWidgetDrilldown(id, config)`.
- Nova server function `runDrilldownQuery({ widgetId })` que busca o widget, valida a config, executa a SQL na conexão (read-only, `LIMIT 1000`) e devolve `{ columns, rows }`. Reaproveita o pipeline já usado pelos widgets atuais.

### 2. Componentes novos

- `src/components/WidgetDrilldownDialog.tsx` — diálogo no editor para configurar:
  - tipo (Tabela / Dashboard / Desativado);
  - se Tabela: título, conexão (default = a do widget) e SQL com textarea;
  - se Dashboard: select dos dashboards da org.
- `src/components/DrilldownTableSheet.tsx` — overlay (Sheet/Dialog) acionado em runtime:
  - chama `runDrilldownQuery` via TanStack Query;
  - render de tabela com busca, ordenação por coluna e botão "Exportar CSV";
  - estados de loading/erro/vazio.

### 3. Integração nos widgets

`WidgetRenderer.tsx`:
- aceita `onDrilldown?: (slice?: { name: string; value: number }) => void` e `clickable?: boolean`;
- se `clickable`, envolve o conteúdo em `<button>` com `cursor-pointer` + foco visível;
- em `BarChart` e `PieChart` (donut), repassa `onClick` para `<Bar>`/`<Pie>` enviando o ponto clicado para que a planilha possa filtrar por `name`;
- em `table`, cada linha vira clicável (mesmo callback com a row).

`MetricCard.tsx`: já recebe um wrapper de clique do `WidgetRenderer` — sem mudanças internas.

`WidgetGrid.tsx`:
- modo view: passa `clickable` quando o widget tem `drilldown`, abre `DrilldownTableSheet` (tipo table) ou navega via `useNavigate` (tipo dashboard);
- modo editor: novo botão 🔍 ao lado do 🔔 e 𝑨± que abre `WidgetDrilldownDialog`. Ícone fica destacado quando há config ativa.
- nova prop `onDrilldownChange(widgetId, config)` ligada a `updateWidgetDrilldown` no editor.

### 4. TV e Slideshow

`FullscreenDashboard.tsx`: já usa `WidgetGrid`/`WidgetRenderer` em modo view → herda o clique automaticamente. O overlay abre por cima do conteúdo TV.

`SlideshowPlayer.tsx`:
- adicionar estado `drilldownOpen`;
- quando `true`, suspende o timer de auto-avanço (semelhante ao botão pausar atual);
- ao fechar, retoma de onde parou.

### 5. Segurança da query de detalhe

A `runDrilldownQuery` server function:
- exige autenticação (`requireSupabaseAuth`) e valida que o usuário pertence à org dona do widget;
- rejeita SQL que não comece com `SELECT` (regex simples + bloqueio de `;` no meio);
- envolve em `LIMIT 1000` se ausente;
- usa o mesmo client de leitura usado hoje pelos widgets — sem novos privilégios.

### 6. UX dos cliques nos gráficos

- **Métrica**: clique abre a tabela com a SQL configurada, sem filtro.
- **Tabela**: clicar numa linha pode passar `{ key: row.name }` como bind opcional `:slice` para a SQL (substitui na server function via parâmetro nomeado, sem string concat).
- **Bar / Donut**: clique numa fatia/barra envia o `name` da série como `:slice`.

Se a SQL não usar `:slice`, o filtro é ignorado.

### 7. Arquivos tocados

- `supabase-schema-step10-widget-drilldown.sql` (novo)
- `src/lib/data.ts` (tipo + updater)
- `src/lib/drilldown.functions.ts` (novo — server function)
- `src/components/WidgetDrilldownDialog.tsx` (novo)
- `src/components/DrilldownTableSheet.tsx` (novo)
- `src/components/WidgetRenderer.tsx`
- `src/components/WidgetGrid.tsx`
- `src/components/SlideshowPlayer.tsx`
- `src/routes/_authenticated/app.dashboards.$id.edit.tsx` (handler `onDrilldownChange`)

### 8. Passos pós-implementação para o usuário

1. Rodar `supabase-schema-step10-widget-drilldown.sql` no SQL Editor do Lovable Cloud.
2. Em **Editar dashboard** clicar no 🔍 do card → escolher **Tabela** → colar a SQL de detalhe.
3. Voltar ao dashboard / TV / Slideshow e clicar no card para abrir a planilha.
