## Objetivo

1. **Modo TV** — abrir um dashboard em tela cheia, sem chrome do app, com atualização automática (padrão 160s).
2. **Slideshow** — montar playlists de dashboards, escolher tempo de cada um, abrir em tela cheia com rotação automática, controles de pausar/próximo/anterior e barra de progresso.

## Migração SQL (novo arquivo `supabase-schema-step7-slideshows.sql`)

Duas tabelas:

```sql
create table public.slideshows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  default_seconds int not null default 30,
  created_at timestamptz not null default now()
);

create table public.slideshow_items (
  id uuid primary key default gen_random_uuid(),
  slideshow_id uuid not null references public.slideshows(id) on delete cascade,
  dashboard_id uuid not null references public.dashboards(id) on delete cascade,
  position int not null,
  seconds int not null default 30
);

-- RLS: select/insert/update/delete liberado para membros da org
-- (mesmo padrão das tabelas dashboards/widgets já existentes)
```

Arquivo gerado em `/mnt/documents/` para download e em `/dev-server/`.

## Camada de dados (`src/lib/data.ts`)

- Tipos: `Slideshow { id, orgId, name, defaultSeconds }` e `SlideshowItem { id, slideshowId, dashboardId, position, seconds }`.
- Funções: `listSlideshows(orgId)`, `getSlideshow(id)`, `listSlideshowItems(slideshowId)`, `createSlideshow(orgId, name, defaultSeconds)`, `updateSlideshow(id, patch)`, `deleteSlideshow(id)`, `setSlideshowItems(slideshowId, items)` (substitui em transação simples: delete + insert).

## Componentes novos

### `src/components/FullscreenDashboard.tsx`
Renderiza um dashboard em tela cheia (sem AppShell):
- Carrega `dashboard + widgets + connections` por id.
- Reusa `<WidgetGrid editable={false} />`.
- Header flutuante minimalista (auto-hide após 3s sem mouse): nome do dashboard, indicador de progresso (barra fina no topo), botões Pausar/Retomar e Sair (X). Tecla `ESC` também sai.
- Prop `intervalSeconds` (refresh auto): a cada N segundos chama `emit()` de `data.ts` para forçar re-fetch dos widgets, ou re-monta via key.
- Usa `document.documentElement.requestFullscreen()` ao montar; se falhar, segue ocupando 100vw/100vh.

### `src/components/SlideshowPlayer.tsx`
Wrapper de fullscreen para slideshow:
- Recebe `items: { dashboardId, seconds }[]`.
- Estado: `currentIndex`, `paused`, `elapsed`.
- Timer com `setInterval(100ms)` atualizando `elapsed`; ao chegar em `seconds * 1000`, avança índice (loop). Pausa congela.
- Renderiza `<FullscreenDashboard dashboardId={...} hideOwnChrome />` e por cima adiciona controles próprios: Anterior, Pausar/Play, Próximo, Sair, barra de progresso (largura = `elapsed/total`), badge "X/Y — Nome do dashboard".
- ESC sai; setas ←/→ trocam; Espaço pausa.

## Rotas novas (`src/routes/_authenticated/`)

- `app.tv.index.tsx` — `/app/tv` — lista dashboards da org como cards; clicar abre `/app/tv/$id`. Possui campo "intervalo (segundos)" persistido em localStorage (default 160).
- `app.tv.$id.tsx` — `/app/tv/:id` — renderiza `<FullscreenDashboard dashboardId intervalSeconds />`. Sai voltando para `/app/tv`.
- `app.slideshow.index.tsx` — `/app/slideshow` — lista playlists da org, botão "Nova playlist", "Reproduzir", "Editar", "Excluir".
- `app.slideshow.new.tsx` e `app.slideshow.$id.edit.tsx` — formulário: nome, tempo padrão, lista ordenável de dashboards (adicionar/remover/reordenar com setas, tempo individual em segundos por item). Salva via `setSlideshowItems`.
- `app.slideshow.$id.play.tsx` — `/app/slideshow/:id/play` — carrega itens + dashboards e renderiza `<SlideshowPlayer />`. Sai voltando para `/app/slideshow`.

> Essas 5 rotas ficam dentro de `_authenticated/` para herdar o gate de sessão. As rotas de "play" (`tv/$id` e `slideshow/$id/play`) renderizam **fora** do `AppShell` para ocupar 100% da tela — para isso, o layout `_authenticated.tsx` passa a aplicar `AppShell` somente quando a rota atual NÃO casa com os padrões `/app/tv/:id` ou `/app/slideshow/:id/play`. (Verificação via `useRouterState` + regex.)

## Atualizações de menus

### `src/components/AppShell.tsx` (sidebar)
Adicionar dois itens em `nav` (entre Dashboards e Conexões):
- `{ to: "/app/tv", label: "Modo TV", icon: Tv }`
- `{ to: "/app/slideshow", label: "Slideshow", icon: PlayCircle }`

### `src/components/MobileBottomNav.tsx`
Hoje tem 4 itens (Dashboards, Conexões, Explorer, Config). Adicionar acesso aos novos sem poluir a barra:
- Substituir o slot "Explorer" por um botão "Mais" que abre um `Sheet` (Drawer) com lista completa: Dashboards, Conexões, Explorer, Modo TV, Slideshow, Configurações.
- Bottom nav final fica: Dashboards | Conexões | Modo TV | Mais.

(Mantém compatibilidade — Explorer continua acessível via "Mais".)

## Detalhes técnicos importantes

- **Fullscreen API**: chamado dentro de `useEffect` após interação inicial; navegadores exigem gesto do usuário, então a página `tv/$id` mostra um botão "Entrar em tela cheia" se `requestFullscreen` rejeitar (erro silencioso → fallback para layout 100vw/100vh com mesmos controles).
- **Auto-refresh do Modo TV**: cada `WidgetRenderer` já tem seu próprio `refreshInterval`; o intervalo do Modo TV é um *override* global — incrementamos um `refreshTick` em estado e passamos como `key` para `<WidgetGrid>` forçar refetch.
- **SSR**: `FullscreenDashboard` e `SlideshowPlayer` usam `window`/`document` — guardar com `if (typeof window !== "undefined")` e efetuar `requestFullscreen` apenas em `useEffect`.
- **Persistência do intervalo TV**: `localStorage["flup.tvIntervalSeconds"]`.

## Fora de escopo
- Compartilhamento público de TV via URL sem login (continua exigindo sessão).
- Transições animadas entre slides (corte simples).
- Edição de dashboards dentro do Modo TV.

## Ação manual necessária
Após aprovação e implementação, o usuário precisa rodar `supabase-schema-step7-slideshows.sql` no SQL Editor do Lovable Cloud para criar `slideshows` e `slideshow_items`.
