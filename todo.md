# Project TODO

- [x] Modelar banco de dados para produtos, uploads de planilha, pedidos, itens do pedido e métricas mensais
- [x] Implementar importação da planilha Excel com armazenamento seguro do arquivo original em S3
- [x] Preservar nomenclatura exata dos campos da planilha: SKU, Título, Tabela Nova CK, Imposto, Comissão, Valor Produto, Preço Desejado, Margem Desejada, Preço Final, Margem Final e Lucro
- [x] Criar busca de produtos por nome e SKU para montagem rápida de pedidos
- [x] Implementar simulador de pedidos com separação clara entre valores para cliente e valores para Mondial
- [x] Exibir coluna dedicada para Everton Mondial com taxa fixa de 0,75 por produto
- [x] Gerar automaticamente lista do cliente com preços de venda ao finalizar pedido
- [x] Gerar automaticamente lista da Mondial com valores de compra ao finalizar pedido
- [x] Registrar histórico completo de pedidos com produtos, quantidades e valores
- [x] Construir dashboard mensal com total de compras, custos, lucros e margem por período
- [x] Enviar notificação automática ao proprietário quando um pedido for criado ou finalizado
- [x] Escrever testes vitest para cálculos, importação e fluxos principais
- [x] Validar interface funcional e limpa para operação comercial
