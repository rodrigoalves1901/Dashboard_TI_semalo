## Objetivo

Transformar a experiência mobile (<768px) para parecer um app nativo, com a navegação principal fixa no rodapé. Desktop e tablet continuam com a sidebar lateral atual — sem mudanças.

## O que muda

### 1. Esconder a sidebar lateral no mobile
Em `src/components/AppShell.tsx`, o `<aside>` já usa `hidden md:flex`, então no mobile ele não aparece. Manter assim.

### 2. Criar uma barra inferior de navegação (mobile-only)
Novo componente `src/components/MobileBottomNav.tsx`:
- Fixa no rodapé (`fixed bottom-0 inset-x-0 z-40`), visível apenas em mobile (`md:hidden`).
- Fundo `bg-card`, borda superior `border-t border-border`, com `backdrop-blur` e safe-area (`pb-[env(safe-area-inset-bottom)]`).
- 4 itens principais com ícone + label curto: **Dashboards**, **Conexões**, **Explorer**, **Config**.
- Item ativo em `text-primary` com indicador (linha/dot) acima; inativos em `text-muted-foreground`.
- Cada item é um `<Link>` do TanStack Router com detecção de rota ativa (mesma lógica `isActive` do AppShell).

### 3. Header mobile mais enxuto (estilo app)
No header de `AppShell.tsx`:
- Esconder o botão de toggle da sidebar no mobile (já é `hidden md:grid`).
- Esconder o botão "Nova conexão" no mobile (já é `hidden sm:inline-flex`).
- Manter busca, theme toggle e notificações compactos.
- Adicionar avatar/menu do usuário no canto direito do header **apenas em mobile** (já que a sidebar — que tem o botão de sair — fica oculta). Dropdown com nome, email, troca de organização e "Sair".

### 4. Padding inferior no `<main>` para não ficar atrás da bottom nav
Adicionar `pb-20 md:pb-0` no `<main>` para reservar o espaço da barra fixa no mobile.

### 5. Renderizar a `MobileBottomNav` dentro do `AppShell`
Logo após o `<main>`, fora do flex principal.

## Arquivos afetados

- `src/components/AppShell.tsx` — adicionar avatar/menu mobile no header, padding no main, incluir `<MobileBottomNav />`.
- `src/components/MobileBottomNav.tsx` — **novo arquivo**.

## Detalhes técnicos

- Sem mudanças em rotas, dados ou lógica de negócio.
- Tokens semânticos do design system (`bg-card`, `text-primary`, `border-border`, `text-muted-foreground`) — sem cores hardcoded.
- Safe-area iOS via `env(safe-area-inset-bottom)`.
- Itens da bottom nav reutilizam o mesmo array `nav` já existente no `AppShell` (extraído para compartilhamento, ou duplicado de forma simples no novo componente).
