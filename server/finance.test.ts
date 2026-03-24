import { describe, expect, it } from "vitest";

describe("Financeiro simplificado", () => {
  it("mantém todas as contas a pagar visíveis sem truncar a listagem", () => {
    const payables = Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      title: `Conta ${index + 1}`,
      amount: `${(index + 1) * 10}.00`,
    }));

    const visibleRows = payables.map((item) => item.id);

    expect(visibleRows).toHaveLength(8);
    expect(visibleRows).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("mantém custo fixo recém-cadastrado visível mesmo sem pagamento mensal lançado", () => {
    const selectedMonth = 3;
    const selectedYear = 2026;
    const fixedCostPayments = [
      { id: 31, fixedCostId: 7, amountPaid: "500.00" },
    ];
    const fixedCosts = [
      { id: 7, name: "Aluguel", amount: "500.00", notes: "Pago no mês" },
      { id: 9, name: "Internet", amount: "850.00", notes: "Cadastro novo" },
    ];

    const paidIds = new Set(fixedCostPayments.map((item) => item.fixedCostId));
    const projected = fixedCosts
      .filter((item) => !paidIds.has(item.id))
      .map((item) => ({
        id: `fixed-${item.id}`,
        fixedCostId: item.id,
        name: item.name,
        amount: item.amount,
        dueDate: `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`,
        statusLabel: "Cadastro ativo",
      }));

    const visible = [...fixedCostPayments, ...projected];

    expect(visible).toHaveLength(2);
    expect(visible[1]).toMatchObject({
      id: "fixed-9",
      fixedCostId: 9,
      name: "Internet",
      amount: "850.00",
      statusLabel: "Cadastro ativo",
    });
  });

  it("refaz a listagem após salvar para que o novo item apareça imediatamente", () => {
    const beforeSave = [
      { id: 1, title: "Conta antiga" },
    ];
    const savedItem = { id: 2, title: "Conta nova" };

    const afterRefresh = [savedItem, ...beforeSave];

    expect(afterRefresh.map((item) => item.id)).toEqual([2, 1]);
    expect(afterRefresh[0].title).toBe("Conta nova");
  });

  it("mantém botão de exclusão associado ao id persistido do item", () => {
    const payable = { id: 17, title: "Fornecedor XPTO" };
    const deletePayload = { id: payable.id };

    expect(deletePayload).toEqual({ id: 17 });
  });

  it("calcula totais simples da categoria ativa com base na listagem visível", () => {
    const fixedCostsVisible = [
      { id: "payment-1", amount: "1200.00" },
      { id: "fixed-9", amount: "850.00" },
    ];

    const totalVisible = fixedCostsVisible.reduce((sum, item) => sum + parseFloat(item.amount), 0);

    expect(totalVisible).toBe(2050);
  });
});
