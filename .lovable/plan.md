## Objetivo

1. Adicionar dois novos tipos de "widget" não-dados: **markdown** (texto rico com imagens) e **divisória** (linha separadora com rótulo opcional). Eles servem para organizar visualmente o dashboard.
2. Criar um botão **"Criar dashboard modelo"** que gera um dashboard pronto, com todos os widgets/gráficos disponíveis + exemplos de markdown e divisórias, para servir de referência.

## Mudanças

### 1. Banco de dados (nova migração)
Arquivo `supabase-schema-step6-widget-content.sql`:
- `ALTER TABLE widgets ADD COLUMN content text;` (armazena o markdown).
- Atualizar a `CHECK constraint` de `chart_type` para aceitar também `'markdown'` e `'divider'`.
- Tornar `preset` opcional (nullable) — markdown/divider não usam preset.

### 2. Tipos e camada de dados (`src/lib/data.ts`)
- `ChartType = "metric" | "bar" | "line" | "donut" | "table" | "markdown" | "divider"`.
- Adicionar `content: string | null` em `Widget`.
- Mapear `content` em `mapWidget` e em `createWidget`.
- Nova função `createSampleDashboard(orgId)` que cria um dashboard "Modelo — Todos os widgets" e insere, em ordem, os widgets abaixo com posições pré-definidas (x, y, w, h):
  - Divisória "Visão geral" (full width, h=1)
  - 4 métricas: tickets em aberto, resolvidos, pendentes, atrasados (w=3 cada)
  - Markdown introdutório com imagem ilustrativa (w=12, h=3)
  - Divisória "Distribuições"
  - Donut "Tickets por status" (w=6) + Donut "Tickets por prioridade" (w=6)
  - Bar "Tickets por categoria" (w=6) + Bar "Tickets por técnico" (w=6)
  - Divisória "Evolução & SLA"
  - Line "Evolução de tickets" (w=8) + Métrica "Cumprimento de SLA" (w=4)
  - Tabela "Tickets por status" (w=12)
  - Markdown final com instruções de uso

### 3. Renderização (`src/components/WidgetRenderer.tsx`)
- Caso `chartType === "divider"`: renderiza uma faixa fina com `<hr>` + label centralizado (usa `title` como rótulo).
- Caso `chartType === "markdown"`: renderiza `react-markdown` + `remark-gfm`, com `img` estilizado (rounded, max-w-full) e classes `prose` Tailwind. Conteúdo vem de `widget.content`.
- Instalar dependências: `react-markdown`, `remark-gfm`.

### 4. Formulário de widget (`src/components/WidgetForm.tsx`)
- Adicionar dois novos botões em "Tipo": **Texto/Markdown** e **Divisória**.
- Quando `chartType` for `markdown` ou `divider`:
  - Esconder os campos "Conexão" e "Métrica".
  - Para markdown: mostrar `<textarea>` grande para o conteúdo (com dica "suporta markdown e imagens via `![alt](url)`").
  - Para divider: mostrar apenas o campo de título (usado como rótulo).
- Passar `content` no `createWidget`.

### 5. Grid (`src/components/WidgetGrid.tsx`)
- `defaultPosition`: para `divider` retornar `w: 12, h: 1`; para `markdown` `w: 12, h: 3`.
- Em modo edição, divider/markdown também têm o handle de arraste e botão remover (já é genérico).

### 6. Página de dashboards (`src/routes/_authenticated/app.index.tsx`)
- Adicionar botão secundário **"Criar dashboard modelo"** ao lado do "Novo dashboard". Chama `createSampleDashboard(currentOrg.id)` e navega para o dashboard recém-criado. Mostra toast de sucesso.

### 7. Tela de visualização do dashboard
Sem mudanças — `WidgetGrid` + `WidgetRenderer` cuidam de tudo.

## Fora de escopo
- Editor WYSIWYG (markdown puro já atende).
- Upload de imagens: o usuário cola URLs externas no markdown (sem storage).