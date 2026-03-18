# Chart Debug

O gráfico aparece corretamente no preview do dev server (desktop).
O problema reportado pelo usuário é no celular (site publicado).
O gráfico mostra Jan/2026, Fev/2026, Mar/2026 com barras de Vendas, Lucro e Compras.

O problema pode ser:
1. O container do gráfico tem style com minHeight e className com h-[260px] - conflito de estilos
2. No mobile, o canvas pode não ter espaço suficiente para renderizar
3. O aspecto ratio pode estar conflitando

Solução: simplificar o container, usar apenas className para altura, garantir que o canvas tenha espaço.
