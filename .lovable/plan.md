## O que vamos entregar

Três pacotes claramente separados:

### 1. Criação de widgets — destravar e simplificar

- Garantir que a tabela `widgets` existe com todas as colunas (incluindo a nova `position` jsonb) e RLS funcional via migração SQL.
- No editor (`/app/dashboards/$id/edit`), o botão "Adicionar ao dashboard" continua a ser o caminho oficial; vou exibir um toast de erro detalhado se a inserção falhar (RLS, FK etc.) para você ver a causa real.
- Atalho rápido na própria visualização do dashboard (`/app/dashboards/$id`): um botão "+ Adicionar widget" abre um diálogo (modal shadcn) com o mesmo formulário do editor — assim não precisa entrar no editor toda vez.
- Widgets continuam usando os presets GLPI mockados (`glpi-presets.ts`). Nada muda em dados — já é tudo mock.

### 2. Mover e redimensionar widgets (drag & resize)

- Adicionar dependência `react-grid-layout`.
- Adicionar coluna `position jsonb` em `widgets` (formato `{x,y,w,h}`).
- Renderizar o grid no **modo edição** (`.../edit`) com arrastar/redimensionar habilitado e no **modo view** (`.../$id`) só leitura, mas respeitando o layout salvo.
- Salvar layout ao soltar (debounce 400ms) via novo `updateWidgetPosition`.
- Posições padrão geradas para widgets antigos sem `position`.

### 3. Menu "Explorer" — explorar tabelas dos bancos conectados

- Novo item no sidebar (`AppShell.tsx`): **Explorer** com ícone `Table2`, rota `/app/explorer`.
- Página com layout 2 colunas:
  - Esquerda: lista de conexões da org. Ao escolher uma → lista de tabelas.
  - Direita: schema da tabela selecionada (colunas + tipos) + botão "Executar SELECT *" que mostra primeiras 50 linhas em uma tabela.
- Para conexão **demo** (e como fallback enquanto não temos firewall liberado): catálogo mockado de tabelas GLPI (`glpi_tickets`, `glpi_users`, `glpi_groups`, `glpi_categories`, `glpi_tickets_users`) com colunas realistas e linhas de exemplo geradas em `src/lib/glpi-schema-mock.ts`.
- Para conexões MySQL/MariaDB/SQL Server: nova server fn `listTables` + `describeTable` + `runSelect` em `src/lib/explorer.functions.ts` (com `LIMIT 50` forçado e bloqueio de qualquer comando que não seja `SELECT`). Se a conexão falhar (firewall), cai pro mock com aviso.
- SharePoint: mostra mensagem "Explorer indisponível para SharePoint" (não tem tabelas SQL).

## Arquivos novos / alterados

**Novos**
- `src/routes/_authenticated/app.explorer.tsx` — página Explorer
- `src/lib/glpi-schema-mock.ts` — catálogo + linhas mockadas
- `src/lib/explorer.functions.ts` — server fns `listTables`, `describeTable`, `runSelect`
- `supabase-schema-step5-widget-position.sql` — migração com `alter table widgets add column position jsonb`

**Alterados**
- `src/components/AppShell.tsx` — adicionar item "Explorer" no nav
- `src/lib/data.ts` — incluir `position` no tipo `Widget`, helper `updateWidgetPosition`
- `src/routes/_authenticated/app.dashboards.$id.edit.tsx` — usar `react-grid-layout` editável
- `src/routes/_authenticated/app.dashboards.$id.tsx` — usar `react-grid-layout` em modo só leitura + botão de atalho "Adicionar widget" abrindo o diálogo
- `package.json` — `react-grid-layout` + tipos

## Detalhes técnicos

- Segurança Explorer: `runSelect` valida com regex `^\s*select\b` e rejeita `;`, `--`, `insert|update|delete|drop|alter|truncate|grant|revoke`. Sempre concatena `LIMIT 50` se não houver.
- O grid usa breakpoints `lg/md/sm` (cols 12/8/4) e altura de linha 80px. Métricas default `w=3 h=2`, gráficos `w=6 h=3`, tabelas `w=12 h=4`.
- Migration roda via SQL editor do Cloud; instruções no topo do arquivo.

Posso seguir com a implementação?
