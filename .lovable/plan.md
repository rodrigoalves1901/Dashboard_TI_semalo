## Problema

A tela `/login` (e `/signup`, `/app/settings`) chama `useAppSettings()`, que lança:

> useAppSettings must be used inside AppSettingsProvider

Motivo: `AppSettingsProvider` foi criado em `src/hooks/use-app-settings.tsx` mas **nunca é montado** na árvore de componentes. Em `src/routes/__root.tsx` só temos `<AuthProvider>`.

Os demais erros do console (`bat.bing.com` CORS, `facebook.com/tr`, `firestore.googleapis.com`, `analytics.tiktok.com`, `rs.lovable.dev`, websocket do dev server) vêm da **interface do Lovable**, não do seu app — pode ignorar.

## Correção

Editar **`src/routes/__root.tsx`**:

1. Importar `AppSettingsProvider` de `@/hooks/use-app-settings`.
2. Em `RootComponent`, envolver `<Outlet />` + `<Toaster />` com `<AppSettingsProvider>` dentro de `<AuthProvider>`:

```tsx
<AuthProvider>
  <AppSettingsProvider>
    <Outlet />
    <Toaster />
  </AppSettingsProvider>
</AuthProvider>
```

Isso é tudo — uma única edição resolve o crash em todas as rotas que usam `useAppSettings`.
