# PRD — DigitalDash (Plataforma de Dashboards)

**Versão:** 1.0  
**Data:** 15 de maio de 2026  
**Status:** Em desenvolvimento ativo  
**Stack:** TanStack Start v1 + React 19 + Vite 7 + Tailwind v4 + Supabase

---

## 1. Visão Geral

DigitalDash é uma plataforma multi-organização para criar, visualizar e exibir dashboards conectados a fontes de dados externas (MySQL, MariaDB, SQL Server, SharePoint) com suporte a apresentação em tela cheia (Modo TV) e rotação automática (Slideshow), pensada para uso em monitores corporativos, salas de operação e NOCs.

### 1.1 Problema

Equipes operacionais precisam exibir indicadores em tempo real em telas compartilhadas, mas as ferramentas atuais exigem licenças caras, configuração complexa ou não suportam rotação entre múltiplos painéis.

### 1.2 Proposta de valor

- **Setup zero**: backend embutido supabase, sem instalação local.
- **Multi-fonte**: conecta direto em bancos relacionais e SharePoint.
- **Modo TV nativo**: tela cheia + auto-refresh + escala de fonte ajustável.
- **Slideshow**: alterna dashboards automaticamente com tempo individual por slide.
- **Multi-org**: isolamento completo por organização via RLS.

### 1.3 Público-alvo

- Times de TI/Service Desk (uso primário com presets GLPI).
- Operações que precisam de painéis públicos em telas físicas.
- Pequenas e médias empresas sem orçamento para BI corporativo.

---

## 2. Personas

| Persona          | Descrição                                | Necessidade principal                                      |
| ---------------- | ---------------------------------------- | ---------------------------------------------------------- |
| **Admin de Org** | Cria organização, conexões e dashboards. | Configurar rapidamente fontes e compartilhar com a equipe. |
| **Editor**       | Cria/edita widgets e playlists.          | Montar dashboards relevantes sem escrever SQL complexo.    |
| **Visualizador** | Acessa dashboards e modos TV.            | Acompanhar indicadores sem interferir na configuração.     |
| **Tela física**  | Monitor dedicado em parede/sala.         | Exibir dashboards em loop, sem interação.                  |

---

## 3. Escopo Funcional

### 3.1 Autenticação & Organizações

- Login por e-mail/senha supabase Auth.
- Recuperação e redefinição de senha.
- Cada usuário pode pertencer a várias organizações; troca via seletor.
- Criação de novas organizações pelo próprio usuário.
- RLS garante isolamento total dos dados entre orgs.

### 3.2 Conexões

- Tipos suportados: `mysql`, `mariadb`, `sqlserver`, `sharepoint`, `demo`.
- Campos: nome, host, porta, database, usuário, senha, SSL.
- SharePoint usa o mesmo schema (host=tenantId, database=siteUrl, username=clientId, password=clientSecret).
- CRUD completo na rota `/app/connections`.
- Conexões pertencem à org atual.

### 3.3 Explorer

- Rota `/app/explorer` para inspecionar schemas e fazer queries exploratórias.
- Presets prontos para GLPI (`glpi-presets.ts`).

### 3.4 Dashboards

- CRUD em `/app/dashboards`.
- Cada dashboard contém N widgets organizados em grid (drag & resize).
- Modo edição vs modo visualização.
- Persistência de posição (`x, y, w, h`) por widget.

### 3.5 Widgets

Tipos suportados:

- `metric` — número grande (KPI) com escala de fonte ajustável (`valueScale`, 0.5×–6×).
- `bar`, `line`, `donut` — gráficos.
- `table` — listagem tabular.
- `markdown` — texto rico.
- `divider` — separador visual.

Cada widget vincula-se a uma conexão + preset, com `refreshInterval` próprio.

### 3.6 Modo TV

- Rota `/app/tv` lista dashboards disponíveis.
- Rota `/app/tv/$id` abre o dashboard em tela cheia (sem AppShell).
- Auto-refresh global (padrão **160s**, persistido em `localStorage`).
- Header flutuante minimalista com auto-hide.
- Escala de fonte global ajustável (`+`/`−`), persistida em `localStorage`.
- Saída via botão `X` ou tecla `ESC`.

### 3.7 Slideshow

- Rota `/app/slideshow` lista playlists.
- Editor (`/app/slideshow/new` e `/app/slideshow/$id/edit`):
  - Nome da playlist.
  - Tempo padrão por slide.
  - Lista ordenável de dashboards com tempo individual.
- Player (`/app/slideshow/$id/play`):
  - Tela cheia contínua (não sai ao trocar de slide).
  - Barra de progresso fina no topo.
  - Badge `X/Y — Nome do dashboard` no canto superior direito.
  - Controles colapsáveis no canto inferior direito: anterior, pausar/play, próximo, sair.
  - Atalhos: `ESC` sair, `←/→` trocar slide, `Espaço` pausar.

### 3.8 Configurações

- Rota `/app/settings` para preferências da org e do usuário.
- Toggle de tema (claro/escuro).

---

## 4. Modelo de Dados (PostgreSQL via supabase)

### Tabelas

| Tabela            | Função                                                                   |
| ----------------- | ------------------------------------------------------------------------ |
| `orgs`            | Organizações (multi-tenant).                                             |
| `org_members`     | Vínculo usuário ↔ org (papéis).                                          |
| `connections`     | Fontes de dados por org.                                                 |
| `dashboards`      | Dashboards por org.                                                      |
| `widgets`         | Widgets de cada dashboard (inclui `position`, `content`, `value_scale`). |
| `slideshows`      | Playlists por org (`default_seconds`).                                   |
| `slideshow_items` | Itens da playlist (`dashboard_id`, `position`, `seconds`).               |
| `app_settings`    | Preferências por org/usuário.                                            |

### Migrações SQL versionadas

- `step3-app-settings`
- `step4-orgs-fix`
- `step5-widget-position`
- `step6-widget-content`
- `step7-slideshows`
- `step8-widget-value-scale`

### Segurança

- RLS habilitado em todas as tabelas.
- Acesso filtrado por membership em `org_members`.
- Roles armazenadas em tabela separada (nunca em `profiles`).

---

## 5. Arquitetura Técnica

### 5.1 Frontend

- **Framework:** TanStack Start v1 (SSR + file-based routing).
- **UI:** React 19 + Tailwind v4 + shadcn/ui.
- **Estado de servidor:** server functions (`createServerFn`) + Supabase client.
- **Roteamento:** rotas em `src/routes/`, layout autenticado via `_authenticated.tsx`.
- **Rotas fullscreen** (`/app/tv/$id`, `/app/slideshow/$id/play`) renderizam fora do AppShell.

### 5.2 Backend

- **Supabase** Supabase gerenciado: Postgres + Auth + Storage + Edge.
- Server functions com middleware `requireSupabaseAuth` para chamadas autenticadas.
- Admin client (`supabaseAdmin`) apenas em rotas de servidor confiáveis.

### 5.3 Padrões

- Design tokens semânticos em `src/styles.css` (`oklch`).
- Sem cores hardcoded em componentes.
- Tipos TypeScript em `strict: true`.

---

## 6. Requisitos Não-Funcionais

| Categoria           | Requisito                                                     |
| ------------------- | ------------------------------------------------------------- |
| Performance         | Auto-refresh ≥10s; refresh do Modo TV não desmonta widgets.   |
| Disponibilidade     | SLA herdado da plataforma Supabase.                           |
| Segurança           | RLS obrigatório; senhas de conexão criptografadas em repouso. |
| Acessibilidade      | Atalhos de teclado no slideshow; contraste AA no tema escuro. |
| Responsivo          | Bottom nav mobile com drawer "Mais" para itens secundários.   |
| Internacionalização | UI em pt-BR (textos hardcoded; i18n fora do escopo v1).       |

---

## 7. Fluxos Principais

### 7.1 Onboarding

1. Usuário cria conta → cria primeira org → cria primeira conexão → cria dashboard → adiciona widgets.

### 7.2 Modo TV

1. `/app/tv` → escolhe dashboard → clica "Iniciar Modo TV".
2. Browser entra em fullscreen; widgets atualizam a cada N segundos.
3. ESC retorna para a lista.

### 7.3 Slideshow

1. `/app/slideshow` → "Nova playlist" → adiciona dashboards e tempos → salva.
2. "Reproduzir" abre o player em tela cheia com rotação automática.
3. Controles permitem pausar, navegar e ajustar fonte.

---

## 8. Métricas de Sucesso (v1)

- Tempo médio do signup ao primeiro dashboard < 10 minutos.
- ≥1 dashboard rodando em Modo TV por organização ativa.
- Taxa de erro em widgets < 2% das execuções.
- Sessão média de Modo TV > 4h (uso em telas físicas).

---

## 9. Roadmap

### v1 (atual)

- Auth, multi-org, conexões, dashboards, widgets, Modo TV, Slideshow, escala de fonte.

### v1.1 (próximo)

- Compartilhamento público de dashboard via URL com token.
- Transições animadas entre slides.
- Mais presets prontos (Zabbix, Jira).

### v2 (futuro)

- Alertas e notificações por widget.
- Versionamento de dashboards.
- Exportação PDF/PNG.
- API pública para ingestão de dados.

---

## 10. Fora de Escopo (v1)

- Edição de widgets dentro do Modo TV.
- White-label / domínios customizados por org.
- Mobile app nativo.
- Cache de queries server-side.
- Integração com SSO corporativo (SAML/OIDC).

---

## 11. Riscos & Mitigações

| Risco                                                     | Mitigação                                                              |
| --------------------------------------------------------- | ---------------------------------------------------------------------- |
| Conexão direta a bancos do cliente expõe credenciais.     | Armazenar com criptografia; recomendar usuário read-only.              |
| Fullscreen API exige gesto do usuário.                    | Fallback para layout 100vw/100vh + botão "Entrar em tela cheia".       |
| Auto-refresh frequente sobrecarrega DB de origem.         | Mínimo de 10s; orientar uso de réplicas de leitura.                    |
| Token de sessão expira durante exibição prolongada em TV. | Refresh automático via Supabase client; revalidar antes de cada query. |

---

## 12. Glossário

- **Org**: organização (tenant lógico).
- **Widget**: componente visual atômico (KPI, gráfico, tabela).
- **Preset**: query pré-construída para um sistema (ex.: GLPI).
- **Modo TV**: exibição fullscreen de um único dashboard com auto-refresh.
- **Slideshow**: playlist de dashboards rotativos em fullscreen.
