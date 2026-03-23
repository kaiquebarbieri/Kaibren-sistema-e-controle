# Diagnóstico parcial — Financeiro e Obrigações

## Evidências confirmadas

1. O painel **Financeiro** está abrindo em **Fevereiro/2026** e exibindo dados no DRE de caixa.
2. O texto extraído da interface mostra:
   - Entradas do caixa: **R$ 92.096,29**
   - Saídas do caixa: **R$ 104.754,88**
   - Extratos usados: **1**
3. Portanto, o problema relatado de "fevereiro não aparece" não está mais reproduzido da mesma forma na tela principal do Financeiro neste estado atual.
4. A área **Obrigações** foi restaurada e agora exibe dashboards separados com CTAs visíveis:
   - **Contas a pagar** → botão **Nova conta a pagar**
   - **Cartões de crédito** → aba própria
   - **Empréstimos** → aba própria
   - **Custos fixos** → botão **Novo custo fixo**
5. A suíte de testes está passando com **72 testes aprovados**.

## Observação importante

Apesar de fevereiro aparecer no cabeçalho e no DRE, ainda há um comportamento inconsistente na leitura dos movimentos recentes:
- O quadro informa **Entradas recentes: sem entradas relevantes**
- O quadro informa **Saídas recentes: sem saídas relevantes**
- Mas o DRE mostra valores significativos de entradas e saídas

Isso sugere que a API `finance.dre` está trazendo os totais do mês, porém a tela está usando `statement.transactions` na listagem local, enquanto a listagem de extratos parece não incluir o array de transações embutido no retorno de `bankStatements.list`.

## Hipótese técnica principal

A inconsistência mais provável é:
- `finance.dre` usa `getDREData(year, month)` e busca transações em `bank_transactions`
- `Finance.tsx` usa `bankStatements.list` para montar `allTransactions`
- `bankStatements.list` retorna apenas os extratos, não as transações relacionadas
- Resultado: totais aparecem no DRE, mas listas locais e painel Mercado Pago ficam zerados ou vazios

## Próximo ajuste recomendado

1. Fazer o frontend do Financeiro consumir os dados de `finance.dre` para movimentos recentes e métricas do mês; ou
2. Enriquecer `bankStatements.list` com contagens/transações necessárias para a visão do Financeiro.
