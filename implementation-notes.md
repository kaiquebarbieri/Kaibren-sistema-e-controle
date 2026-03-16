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

## Expansão da próxima iteração

| Novo requisito | Direção de implementação |
| --- | --- |
| **Cadastro de clientes** | Criar base própria de clientes com nome e dados reutilizáveis no momento de montar um pedido. |
| **Pedidos pessoais** | Permitir salvar compras do próprio negócio ou do proprietário para compor o total comprado do mês sem confundir com vendas da distribuidora. |
| **Dashboard segmentado** | Separar indicadores de compras pessoais, vendas para clientes, lucro mensal e consolidado da operação. |
| **Busca por cliente** | Permitir localizar cliente já cadastrado pelo nome ao iniciar um novo pedido. |
| **Lucro persistido** | Manter o lucro salvo em cada pedido para compor o dashboard mensal sem recálculo manual. |

## Regras de negócio

| Regra | Descrição |
| --- | --- |
| Separação de listas | Todo pedido finalizado deve gerar uma visão para o cliente com preços de venda e outra para a Mondial com valores de compra |
| Comissão fixa | A coluna dedicada de Everton Mondial deve usar taxa fixa de 0,75 por unidade do item |
| Busca operacional | A montagem do pedido deve permitir encontrar produtos por SKU e por trecho do Título |
| Rastreabilidade | O arquivo Excel original precisa ficar salvo em S3 e vinculado ao catálogo importado |
| Auditoria financeira | Totais mensais devem refletir somatórios de pedidos e itens sem perder os valores originais de cada operação |
| Separação operacional | Pedidos do tipo pessoal e pedidos do tipo cliente devem ser mostrados de forma separada no dashboard e no histórico |
| Cadastro reaproveitável | Clientes cadastrados devem poder ser buscados pelo nome e vinculados a novos pedidos |

## Fluxos principais

O primeiro fluxo é a importação da planilha. O usuário envia o arquivo Excel, o sistema salva o original em S3 para auditoria, lê a aba principal, valida os campos esperados e atualiza o catálogo de produtos preservando os nomes das colunas exibidas na interface.

O segundo fluxo é a simulação de pedido. O usuário pesquisa por SKU ou Título, adiciona produtos, informa quantidades e visualiza simultaneamente o total para o cliente, calculado com base no campo **Preço Desejado** ou **Preço Final**, e o total da Mondial, calculado com base no campo **Valor Produto**. A comissão **Everton Mondial** é destacada por item e agregada no total do pedido.

O terceiro fluxo é a finalização do pedido. Nesse momento, o sistema grava o histórico completo, gera as duas listas operacionais separadas e envia uma notificação ao proprietário informando a criação ou a conclusão do pedido.

O quarto fluxo é o acompanhamento mensal. O dashboard consolida compras, custos, lucros e margem por período selecionado, usando os pedidos registrados no sistema como fonte de verdade.

O quinto fluxo será o cadastro e reaproveitamento de clientes. O usuário poderá cadastrar todos os clientes recorrentes, localizá-los pelo nome durante a montagem da compra e usar seus dados para agilizar a criação de pedidos.

O sexto fluxo será a classificação da operação entre pedido de cliente e pedido pessoal. Assim, o dashboard poderá mostrar quanto foi comprado no mês para uso próprio, quanto foi vendido para clientes da distribuidora e quanto de lucro foi gerado nas revendas salvas.

## Identidade visual Kaibren para exportações e interface

A identidade visual confirmada para esta etapa usa a marca **KaiBren Peças & Utilidades** como referência para as planilhas geradas e para o acabamento visual do fluxo de pedidos.

| Elemento | Valor definido |
| --- | --- |
| Nome da marca | KaiBren Peças & Utilidades |
| Logo CDN | https://d2xsxph8kpxj0f.cloudfront.net/95597689/XxwarzmhDMwJNs5J3puu6o/kaibren-logo_40d0a45a.png |
| Ouro | #D4AF37 |
| Preto | #1C1C1C |
| Marfim | #F5F2E9 |
| Cinza | #8E8E8E |

As exportações devem gerar duas versões separadas por pedido, mantendo a mesma identidade visual: uma planilha para o **cliente**, com SKU, nome do produto, quantidade e valor de venda, e outra planilha para a **Mondial**, com SKU, nome do produto, quantidade, valor de compra e coluna de Everton Mondial.

## Edição manual de preços por produto

A próxima melhoria adiciona edição manual inline na seção **Produtos** para ajustar diretamente o **valor pago à Mondial** (`valorProduto`) e o **valor de venda** (`precoFinal`, mantendo compatibilidade com `precoDesejado`). O fluxo previsto é abrir edição por linha na tabela, permitir salvar os dois campos, persistir a alteração no backend por `id` do produto e recalcular imediatamente os valores de lucro e margem exibidos na interface e no fluxo de montagem do pedido. Essas alterações também devem alimentar automaticamente as listas **Cliente** e **Mondial** geradas no sistema.

## Reorganização do módulo de Produtos

A gestão de produtos passará a existir em um menu próprio de Produtos, separado da tela inicial. Essa área dedicada deve concentrar a busca por SKU e título, o cadastro manual de novos produtos e a edição aberta de valor pago à Mondial e valor de venda, sem depender de botões ocultos em tabelas comprimidas.

A tela inicial deixará de exibir a tabela completa de produtos e ficará focada em indicadores, clientes, configuração de compra e histórico. O novo menu de Produtos deve funcionar como um catálogo operacional, com formulário de cadastro no topo e lista editável abaixo, permitindo que o usuário altere preços diretamente com persistência clara por linha.
