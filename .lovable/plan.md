## Visão geral

Construir uma plataforma SaaS multi-tenant onde cada organização cadastra conexões a bancos de dados de sistemas externos (GLPI primeiro, MySQL/MariaDB) e monta dashboards com gráficos personalizados via um builder simples. Conexões ao banco do GLPI feitas pelo servidor (TanStack server functions) — o navegador nunca fala MySQL diretamente. Identidade, organizações, configs e definições de dashboard ficam no Supabase do usuário.

## Stack

- TanStack Start (já configurado) + Tailwind v4 com tokens do design system Flup
- Supabase (URL + anon key fornecidos pelo usuário) — auth, RLS, storage de configs
- `mysql2` em server functions para conectar no GLPI via IP/porta
- Recharts para gráficos (barras, linhas, donut, métricas)
- Credenciais de conexão criptografadas com chave do servidor antes de salvar

## Modelo de dados (Supabase)

```text
organizations(id, name, created_at)
memberships(org_id, user_id, role: owner|admin|viewer)
profiles(id → auth.users, full_name, avatar_url)

connections(
  id, org_id, name, system_type: 'glpi',
  host, port, database, username,
  encrypted_password, ssl, created_by, created_at
)

dashboards(id, org_id, name, description, layout_json, created_by)
widgets(
  id, dashboard_id, connection_id,
  title, chart_type: 'metric'|'bar'|'line'|'donut'|'table',
  query_config_json,   -- fonte, métrica, dimensão, filtros, agregação
  position_json,       -- x,y,w,h
  refresh_interval
)
```

RLS: tudo filtrado por `org_id` via tabela `memberships`. Função `has_org_access(org_id)` SECURITY DEFINER. Papéis em tabela separada (sem armazenar em `profiles`).

## Arquitetura de conexão GLPI

```text
Browser → TanStack server fn (requireSupabaseAuth)
  → descriptografa credenciais da connection
  → mysql2 conecta no IP:porta do GLPI
  → executa query montada pelo builder
  → devolve linhas agregadas (DTO simples)
```

Server functions principais:
- `testConnection({connectionId})` — ping + lista de tabelas
- `listGlpiEntities({connectionId})` — catálogo de tabelas/views relevantes (tickets, users, entities, categories…)
- `runWidgetQuery({widgetId})` — executa o widget com cache curto

Builder gera SQL parametrizado a partir de `query_config_json` (whitelist de tabelas/colunas GLPI, sem SQL livre no MVP).

## Estrutura de rotas

```text
src/routes/
  __root.tsx                    layout html + providers
  index.tsx                     redirect → /login ou /app
  login.tsx
  signup.tsx
  _authenticated.tsx            beforeLoad: checa sessão Supabase
  _authenticated/
    app.tsx                     layout shell (sidebars + header)
    app/index.tsx               home (lista dashboards)
    app/dashboards.$id.tsx      visualização do dashboard
    app/dashboards.$id.edit.tsx builder
    app/connections.tsx         lista
    app/connections.new.tsx     formulário (host, porta, db, user, senha, test)
    app/settings.tsx            org, membros, perfil
  api/                          (futuras rotas públicas se precisar)
```

## Design system (Flup) em `src/styles.css`

Substituir os tokens default por tokens em oklch equivalentes a:
- `--background` #F4F6F5, `--card` #FFFFFF, `--border` #E5EAE8
- `--primary` #009B72, `--primary-foreground` #FFFFFF
- `--accent` #DFF4ED (sidebar item ativo), `--accent-foreground` #007A5A
- `--foreground` #0B2B22, `--muted-foreground` #6B7C76
- Destructive #E34D4D, success #009B72, warning #F5A623, info #4F7DF3
- Cores de gráfico: `--chart-1..8` mapeadas para azul/laranja/roxo/rosa/ciano/verde/vermelho/amarelo da paleta
- Dark mode com `#0F1714 / #16211D / #2DD4A3`
- Radius base 14px (cards), 8px (botões/inputs)
- Fontes: importar Inter via Google Fonts no `__root.tsx`

Componentes reutilizáveis em `src/components/`:
`AppShell`, `SidebarCompact`, `SidebarMain`, `PageHeader`, `MetricCard`, `ChartCard`, `DonutChartCard`, `AddDataCard`, `PeriodFilter`, `UserProfileMini`, `ThemeToggle`, `DataTable`, `WidgetRenderer`, `WidgetBuilderForm`, `ConnectionForm`.

## Configuração do Supabase do usuário

Como você já tem projeto próprio, vou pedir via tool de secrets:
- `VITE_SUPABASE_URL` (publicável)
- `VITE_SUPABASE_PUBLISHABLE_KEY` (publicável)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, para admin client)
- `CONNECTION_ENCRYPTION_KEY` (32 bytes, para AES-GCM nas senhas dos GLPIs)

Você roda manualmente as migrações SQL geradas no SQL editor do seu Supabase (eu entrego o script pronto).

## Fases de entrega

1. **Fundação visual + auth**
   - Tokens do design system em `styles.css`
   - Login/Signup com email+senha (Supabase) e proteção `_authenticated`
   - Shell com sidebar dupla (compacta + principal) seguindo Flup

2. **Multi-tenant + conexões**
   - Tabelas org/memberships/connections + RLS
   - CRUD de organizações e convite por email (link simples)
   - Tela "Conexões": form com host/port/db/user/senha + botão "Testar conexão"
   - Server fn `testConnection` usando `mysql2` + criptografia

3. **Dashboards e builder**
   - CRUD de dashboards e widgets
   - Builder simples: escolher conexão → entidade GLPI (tickets, técnicos, SLA…) → tipo de gráfico → métrica/dimensão/filtros → preview
   - Renderização com Recharts e grid responsivo

4. **Polimento**
   - Filtros de período globais, refresh automático, dark mode toggle
   - Catálogo expandido de queries GLPI pré-definidas (tickets por status, por técnico, SLA, evolução mensal)

## Detalhes técnicos importantes

- Senhas das conexões cifradas com AES-256-GCM (`CONNECTION_ENCRYPTION_KEY`); só descriptografadas dentro de server functions
- `mysql2` com timeout curto e pool por conexão; queries com `LIMIT` obrigatório no builder
- Whitelist de tabelas/colunas GLPI no servidor — usuário não envia SQL bruto
- `requireSupabaseAuth` em todas as server fns; checagem extra de `has_org_access(org_id)` antes de tocar em qualquer connection
- Migrations entregues como arquivo `.sql` que você roda no Supabase Studio

## O que fica fora do MVP

- SQL livre / editor de query avançado
- Outros sistemas além de GLPI (arquitetura já preparada via `system_type`)
- Compartilhamento público de dashboards
- Alertas / agendamento de relatórios

Quer que eu siga com esse plano? Se sim, na próxima mensagem eu já peço as credenciais do Supabase e a `CONNECTION_ENCRYPTION_KEY` antes de começar a implementar.