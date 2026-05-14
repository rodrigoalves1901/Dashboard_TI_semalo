# Plano: Conexões multi-sistema

## 1. Corrigir o bug de navegação (causa do "nada acontece")

`src/routes/_authenticated/app.connections.tsx` tem o componente da listagem, mas como existe `app.connections.new.tsx`, ela vira **rota pai** automaticamente — e não renderiza `<Outlet />`. Resultado: ao clicar em "Nova conexão" a URL muda para `/app/connections/new`, mas o formulário nunca aparece.

**Solução:**
- Renomear `app.connections.tsx` → `app.connections.index.tsx` (lista vira a rota índice).
- Criar novo `app.connections.tsx` mínimo, apenas layout com `<Outlet />`.

Assim `/app/connections` mostra a lista e `/app/connections/new` mostra o formulário.

## 2. Suporte a múltiplos tipos de conexão

Adicionar seletor de **tipo de sistema** no formulário, com campos dinâmicos conforme o tipo:

| Tipo | Campos | Porta padrão | Driver |
|------|--------|--------------|--------|
| MySQL | host, porta, database, usuário, senha, SSL | 3306 | `mysql2` (já instalado) |
| MariaDB | idem MySQL | 3306 | `mysql2` (compatível) |
| SQL Server | host, porta, database, usuário, senha, encrypt, trustServerCertificate | 1433 | `mssql` (instalar) |
| SharePoint (Graph API) | tenantId, clientId, clientSecret, siteUrl | — | `fetch` direto na Graph API com OAuth client credentials |

O formulário troca os campos visíveis conforme o `systemType` selecionado.

## 3. Server function de teste unificada

Refatorar `src/lib/connections.functions.ts`:
- Validador Zod discriminado por `systemType`.
- Branch por tipo:
  - `mysql` / `mariadb` → `mysql2.createConnection` + `SELECT VERSION()`.
  - `sqlserver` → `mssql.connect` + `SELECT @@VERSION`.
  - `sharepoint` → POST em `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token` (scope `https://graph.microsoft.com/.default`), depois GET em `/v1.0/sites/{host}:/{path}` para validar acesso ao site.
- Retorna `{ ok, latencyMs, version|info }` ou `{ ok: false, message }`.

## 4. Persistência

Atualizar tipo `Connection` em `src/lib/data.ts` para incluir os novos campos opcionais (`tenantId`, `clientId`, `clientSecret`, `siteUrl`, `encrypt`, `trustServerCertificate`) e aceitar `systemType: "mysql" | "mariadb" | "sqlserver" | "sharepoint"`. A listagem em `app.connections.index.tsx` exibe host/porta para bancos e siteUrl para SharePoint.

## Detalhes técnicos

- Instalar dependência: `bun add mssql`. `mssql` é Node-only mas funciona no runtime do Worker com `nodejs_compat` para conexões TCP de saída via `net`. Caso falhe em produção, fallback é uma rota server `/api/...` ou marcar SQL Server como "não suportado em edge" — vou validar com `stack_modern--invoke-server-function` após implementar.
- SharePoint via Graph não precisa de driver — só `fetch`, então é seguro no Worker.
- Senhas continuam sendo guardadas como hoje (mesmo modelo do `Connection` atual). Sem mudança de criptografia neste passo.

## Arquivos afetados

- renomeia `src/routes/_authenticated/app.connections.tsx` → `app.connections.index.tsx`
- novo `src/routes/_authenticated/app.connections.tsx` (layout com `<Outlet />`)
- `src/routes/_authenticated/app.connections.new.tsx` (campos dinâmicos por tipo)
- `src/lib/connections.functions.ts` (multi-driver)
- `src/lib/data.ts` (tipo `Connection` ampliado)
- `package.json` / `bun.lock` (mssql)
