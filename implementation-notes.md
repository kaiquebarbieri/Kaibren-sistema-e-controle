# Modelagem funcional do sistema CK Distribuidora

O sistema será estruturado como um painel interno de gestão comercial com foco em importação de produtos, simulação de pedidos, separação operacional entre venda ao cliente e compra junto à Mondial, e acompanhamento financeiro mensal.

## Entidades principais

| Entidade | Finalidade | Campos principais |
| --- | --- | --- |
| `product_uploads` | Registrar o arquivo Excel original enviado para backup e auditoria | nome do arquivo, URL S3, chave S3, hash, data de upload, usuário |
| `products` | Armazenar o catálogo importado mantendo a nomenclatura da planilha | SKU, Título, Tabela Nova CK, Imposto, Comissão, Valor Produto, Preço Desejado, Margem Desejada, Preço Final, Margem Final, Lucro |
| `orders` | Registrar cada pedido criado no sistema | cliente, status, competência mensal, totais cliente, totais Mondial, lucro total, margem consolidada |
| `order_items` | Registrar os produtos e quantidades de cada pedido | SKU, título, quantidade, valores de venda, valores de compra, comissão Everton Mondial, lucro por item |
| `monthly_snapshots` | Consolidar indicadores por mês para o dashboard | mês, ano, total de pedidos, total cliente, total Mondial, total de custos, total de lucro, margem média |

## Regras de negócio

| Regra | Descrição |
| --- | --- |
| Separação de listas | Todo pedido finalizado deve gerar uma visão para o cliente com preços de venda e outra para a Mondial com valores de compra |
| Comissão fixa | A coluna dedicada de Everton Mondial deve usar taxa fixa de 0,75 por unidade do item |
| Busca operacional | A montagem do pedido deve permitir encontrar produtos por SKU e por trecho do Título |
| Rastreabilidade | O arquivo Excel original precisa ficar salvo em S3 e vinculado ao catálogo importado |
| Auditoria financeira | Totais mensais devem refletir somatórios de pedidos e itens sem perder os valores originais de cada operação |

## Fluxos principais

O primeiro fluxo é a importação da planilha. O usuário envia o arquivo Excel, o sistema salva o original em S3 para auditoria, lê a aba principal, valida os campos esperados e atualiza o catálogo de produtos preservando os nomes das colunas exibidas na interface.

O segundo fluxo é a simulação de pedido. O usuário pesquisa por SKU ou Título, adiciona produtos, informa quantidades e visualiza simultaneamente o total para o cliente, calculado com base no campo **Preço Desejado** ou **Preço Final**, e o total da Mondial, calculado com base no campo **Valor Produto**. A comissão **Everton Mondial** é destacada por item e agregada no total do pedido.

O terceiro fluxo é a finalização do pedido. Nesse momento, o sistema grava o histórico completo, gera as duas listas operacionais separadas e envia uma notificação ao proprietário informando a criação ou a conclusão do pedido.

O quarto fluxo é o acompanhamento mensal. O dashboard consolida compras, custos, lucros e margem por período selecionado, usando os pedidos registrados no sistema como fonte de verdade.
