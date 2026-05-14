## Problema identificado

1. **Card duplicado**: o `WidgetGrid` já desenha o container do widget, mas `WidgetRenderer`/`MetricCard` também desenham outro card com borda, fundo e sombra. Por isso aparece um card dentro de outro.
2. **Botão “Editar dashboard” sem efeito**: a rota `/app/dashboards/$id/edit` está cadastrada como filha da rota `/app/dashboards/$id`, mas a rota pai não renderiza `<Outlet />`. Em TanStack Router, isso impede a tela filha de aparecer ao navegar para `/edit`.

## Plano de correção

1. **Separar conteúdo de widget do container**
   - Ajustar `MetricCard` para aceitar um modo sem “casca” visual, renderizando só o conteúdo interno quando estiver dentro do grid.
   - Ajustar `WidgetRenderer` para usar esse modo e remover borda/fundo/sombra próprios dos gráficos e tabelas quando renderizados dentro do `WidgetGrid`.
   - Manter o preview do formulário com aparência correta, sem criar uma segunda borda dentro do card do grid.

2. **Corrigir navegação para o editor**
   - Atualizar a rota `src/routes/_authenticated/app.dashboards.$id.tsx` para detectar quando há uma rota filha ativa e renderizar `<Outlet />`.
   - Assim, ao clicar em “Editar dashboard”, a tela `src/routes/_authenticated/app.dashboards.$id.edit.tsx` passa a aparecer corretamente.

3. **Refinar o container do grid**
   - Manter apenas uma borda e um fundo por widget.
   - Garantir que o conteúdo ocupe toda a altura do item no grid, evitando sobras visuais parecendo duplicação.

4. **Validar**
   - Confirmar no código que a rota filha tem saída via `<Outlet />`.
   - Verificar que os widgets renderizam com apenas um container visual.