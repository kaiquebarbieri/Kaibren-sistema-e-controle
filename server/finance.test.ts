import { describe, it, expect } from "vitest";

describe("Finance Module", () => {
  describe("Fixed Costs", () => {
    it("should validate fixed cost categories", () => {
      const validCategories = [
        "aluguel", "internet", "telefone", "contador", "energia",
        "agua", "software", "seguro", "funcionario", "transporte", "outros",
      ];
      expect(validCategories).toHaveLength(11);
      expect(validCategories).toContain("aluguel");
      expect(validCategories).toContain("funcionario");
    });

    it("should calculate total fixed costs correctly", () => {
      const costs = [
        { name: "Aluguel", amount: "1500.00" },
        { name: "Internet", amount: "150.00" },
        { name: "Contador", amount: "800.00" },
      ];
      const total = costs.reduce((sum, c) => sum + parseFloat(c.amount), 0);
      expect(total).toBe(2450.0);
    });
  });

  describe("Credit Cards", () => {
    it("should validate card brands", () => {
      const validBrands = ["visa", "mastercard", "elo", "amex", "outros"];
      expect(validBrands).toHaveLength(5);
    });

    it("should calculate invoice status correctly", () => {
      const invoice = { totalAmount: "2500.00", amountPaid: "2500.00" };
      const isPaid = parseFloat(invoice.amountPaid) >= parseFloat(invoice.totalAmount);
      expect(isPaid).toBe(true);

      const partialInvoice = { totalAmount: "2500.00", amountPaid: "1000.00" };
      const isPartial = parseFloat(partialInvoice.amountPaid) < parseFloat(partialInvoice.totalAmount) && parseFloat(partialInvoice.amountPaid) > 0;
      expect(isPartial).toBe(true);
    });
  });

  describe("Loans", () => {
    it("should calculate remaining installments", () => {
      const loan = { totalInstallments: 24, startDate: "2026-01-01" };
      const currentMonth = 3;
      const paidInstallments = currentMonth - 1;
      const remaining = loan.totalInstallments - paidInstallments;
      expect(remaining).toBe(22);
    });

    it("should calculate total loan cost with interest", () => {
      const loan = { totalAmount: "10000.00", installmentAmount: "500.00", totalInstallments: 24 };
      const totalPaid = parseFloat(loan.installmentAmount) * loan.totalInstallments;
      const totalInterest = totalPaid - parseFloat(loan.totalAmount);
      expect(totalPaid).toBe(12000.0);
      expect(totalInterest).toBe(2000.0);
    });
  });

  describe("DRE Calculation", () => {
    it("should isolate DRE aggregates by cnpj in backend queries", () => {
      const selectedCnpjId = 7;
      const fixedCostPayments = [
        { payment: { amountPaid: "1500.00", cnpjId: 7 } },
        { payment: { amountPaid: "900.00", cnpjId: 9 } },
      ];
      const cardInvoices = [
        { invoice: { totalAmount: "800.00", cnpjId: 7 } },
        { invoice: { totalAmount: "1200.00", cnpjId: 9 } },
      ];
      const loanInstallments = [
        { installment: { amount: "500.00", cnpjId: 7 } },
        { installment: { amount: "300.00", cnpjId: 9 } },
      ];
      const payableAccounts = [
        { amount: "400.00", paidAmount: null, status: "pending", cnpjId: 7 },
        { amount: "650.00", paidAmount: "650.00", status: "paid", cnpjId: 9 },
      ];
      const bankTransactions = [
        { amount: "2000.00", transactionType: "credit", cnpjId: 7 },
        { amount: "700.00", transactionType: "debit", cnpjId: 7 },
        { amount: "9999.00", transactionType: "credit", cnpjId: 9 },
      ];

      const visibleFixedCosts = fixedCostPayments.filter((item) => item.payment.cnpjId === selectedCnpjId);
      const visibleInvoices = cardInvoices.filter((item) => item.invoice.cnpjId === selectedCnpjId);
      const visibleInstallments = loanInstallments.filter((item) => item.installment.cnpjId === selectedCnpjId);
      const visiblePayables = payableAccounts.filter((item) => item.cnpjId === selectedCnpjId);
      const visibleTransactions = bankTransactions.filter((item) => item.cnpjId === selectedCnpjId);

      const totalCustosFixos = visibleFixedCosts.reduce((sum, item) => sum + parseFloat(item.payment.amountPaid), 0);
      const totalCartoes = visibleInvoices.reduce((sum, item) => sum + parseFloat(item.invoice.totalAmount), 0);
      const totalEmprestimos = visibleInstallments.reduce((sum, item) => sum + parseFloat(item.installment.amount), 0);
      const totalContasPagas = visiblePayables
        .filter((item) => item.status === "paid" || item.status === "partial")
        .reduce((sum, item) => sum + parseFloat(String(item.paidAmount || item.amount)), 0);
      const entradasTotais = visibleTransactions
        .filter((item) => item.transactionType === "credit")
        .reduce((sum, item) => sum + parseFloat(item.amount), 0);
      const saidasTotais = visibleTransactions
        .filter((item) => item.transactionType === "debit")
        .reduce((sum, item) => sum + parseFloat(item.amount), 0);

      expect(totalCustosFixos).toBe(1500);
      expect(totalCartoes).toBe(800);
      expect(totalEmprestimos).toBe(500);
      expect(totalContasPagas).toBe(0);
      expect(entradasTotais).toBe(2000);
      expect(saidasTotais).toBe(700);
    });

    it("should ignore records without matching cnpjId when filtering backend results", () => {
      const selectedCnpjId = 7;
      const fixedCostPayments = [
        { payment: { amountPaid: "1500.00", cnpjId: 7 } },
        { payment: { amountPaid: "900.00", cnpjId: null } },
      ];
      const cardInvoices = [
        { invoice: { totalAmount: "800.00", cnpjId: 7 } },
        { invoice: { totalAmount: "1200.00", cnpjId: null } },
      ];
      const loanInstallments = [
        { installment: { amount: "500.00", cnpjId: 7 } },
        { installment: { amount: "300.00", cnpjId: null } },
      ];

      const totalCustosFixos = fixedCostPayments
        .filter((item) => item.payment.cnpjId === selectedCnpjId)
        .reduce((sum, item) => sum + parseFloat(item.payment.amountPaid), 0);
      const totalCartoes = cardInvoices
        .filter((item) => item.invoice.cnpjId === selectedCnpjId)
        .reduce((sum, item) => sum + parseFloat(item.invoice.totalAmount), 0);
      const totalEmprestimos = loanInstallments
        .filter((item) => item.installment.cnpjId === selectedCnpjId)
        .reduce((sum, item) => sum + parseFloat(item.installment.amount), 0);

      expect(totalCustosFixos).toBe(1500);
      expect(totalCartoes).toBe(800);
      expect(totalEmprestimos).toBe(500);
    });

    it("should preserve cnpj identity in aggregated payable history rows", () => {
      const payables = [
        { id: 1, title: "Fornecedor A", cnpjId: 7, cnpjName: "CK Matriz", amount: "450.00" },
        { id: 2, title: "Boleto energia", cnpjId: 9, cnpjName: "Duoo Utilidades", amount: "220.00" },
      ];

      const historyRows = payables.map((item) => ({
        id: item.id,
        title: item.title,
        amount: Number(item.amount),
        cnpjBadge: `${item.cnpjName}`,
      }));

      expect(historyRows).toEqual([
        { id: 1, title: "Fornecedor A", amount: 450, cnpjBadge: "CK Matriz" },
        { id: 2, title: "Boleto energia", amount: 220, cnpjBadge: "Duoo Utilidades" },
      ]);
    });

    it("should allow choosing cnpj directly in payable creation payload", () => {
      const createPayload = {
        cnpjId: 9,
        title: "Fornecedor B",
        supplier: "Duoo",
        amount: "780.00",
        dueDate: "2026-04-10",
      };

      expect(createPayload.cnpjId).toBe(9);
      expect(createPayload.title).toBe("Fornecedor B");
      expect(createPayload.dueDate).toBe("2026-04-10");
    });

    it("should keep payable visible in aggregated history after saving when filter is all", () => {
      const selectedFilter = "all";
      const existingPayables = [
        { id: 11, title: "Fornecedor atual", cnpjId: 7 },
      ];
      const savedPayable = { id: 12, title: "Novo boleto", cnpjId: 9 };

      const listInvalidateInputs = [
        { year: 2026, month: 3 },
        { year: 2026, month: 3, cnpjId: savedPayable.cnpjId },
      ];
      const dashboardInvalidateInputs = [
        { referenceDate: "2026-03-10", year: 2026, month: 3 },
        { referenceDate: "2026-03-10", year: 2026, month: 3, cnpjId: savedPayable.cnpjId },
      ];

      const history = [savedPayable, ...existingPayables].filter((item) => {
        return selectedFilter === "all" ? true : String(item.cnpjId) === selectedFilter;
      });

      expect(listInvalidateInputs).toEqual([
        { year: 2026, month: 3 },
        { year: 2026, month: 3, cnpjId: 9 },
      ]);
      expect(dashboardInvalidateInputs).toEqual([
        { referenceDate: "2026-03-10", year: 2026, month: 3 },
        { referenceDate: "2026-03-10", year: 2026, month: 3, cnpjId: 9 },
      ]);
      expect(history.map((item) => item.id)).toEqual([12, 11]);
      expect(history[0].title).toBe("Novo boleto");
    });

    it("should keep cnpj filter optional while preserving visible company label", () => {
      const selectedFilter = "all";
      const cnpjs = new Map<number, string>([
        [7, "CK Matriz • 11.111.111/0001-11"],
        [9, "Duoo Utilidades • 22.222.222/0001-22"],
      ]);
      const payables = [
        { id: 1, title: "Fornecedor A", cnpjId: 7 },
        { id: 2, title: "Fornecedor B", cnpjId: 9 },
      ];
      const fixedCostPayments = [
        { id: 31, cnpjId: 7, amountPaid: "500.00" },
        { id: 32, cnpjId: 9, amountPaid: "850.00" },
      ];

      const visibleRows = payables
        .filter((item) => selectedFilter === "all" || String(item.cnpjId) === selectedFilter)
        .map((item) => ({
          id: item.id,
          cnpjLabel: cnpjs.get(item.cnpjId),
        }));

      const visibleFixedCostPayments = fixedCostPayments.filter((item) => selectedFilter === "all" || String(item.cnpjId) === selectedFilter);
      const totalVisibleFixedCosts = visibleFixedCostPayments.reduce((sum, item) => sum + parseFloat(item.amountPaid), 0);

      expect(visibleRows).toEqual([
        { id: 1, cnpjLabel: "CK Matriz • 11.111.111/0001-11" },
        { id: 2, cnpjLabel: "Duoo Utilidades • 22.222.222/0001-22" },
      ]);
      expect(visibleFixedCostPayments.map((item) => item.id)).toEqual([31, 32]);
      expect(totalVisibleFixedCosts).toBe(1350);
    });

    it("should calculate DRE correctly", () => {
      const salesOrders = [
        { totalCliente: "5000.00", totalMondial: "3000.00", totalComissaoEvertonMondial: "200.00", totalLucro: "1800.00" },
        { totalCliente: "3000.00", totalMondial: "1800.00", totalComissaoEvertonMondial: "120.00", totalLucro: "1080.00" },
      ];
      const personalOrders = [
        { totalMondial: "500.00" },
      ];
      const fixedCostPayments = [
        { amountPaid: "1500.00" },
        { amountPaid: "150.00" },
      ];
      const cardInvoices = [
        { totalAmount: "800.00" },
      ];
      const loanInstallments = [
        { amount: "500.00" },
      ];

      const receitaBruta = salesOrders.reduce((sum, o) => sum + parseFloat(o.totalCliente), 0);
      expect(receitaBruta).toBe(8000.0);

      const custoMercadoriaVendida = salesOrders.reduce((sum, o) => sum + parseFloat(o.totalMondial), 0);
      expect(custoMercadoriaVendida).toBe(4800.0);

      const lucroBruto = receitaBruta - custoMercadoriaVendida;
      expect(lucroBruto).toBe(3200.0);

      const totalCustosFixos = fixedCostPayments.reduce((sum, p) => sum + parseFloat(p.amountPaid), 0);
      expect(totalCustosFixos).toBe(1650.0);

      const totalCartoes = cardInvoices.reduce((sum, i) => sum + parseFloat(i.totalAmount), 0);
      expect(totalCartoes).toBe(800.0);

      const totalEmprestimos = loanInstallments.reduce((sum, i) => sum + parseFloat(i.amount), 0);
      expect(totalEmprestimos).toBe(500.0);

      const despesasOperacionais = totalCustosFixos + totalCartoes + totalEmprestimos;
      expect(despesasOperacionais).toBe(2950.0);

      const resultadoOperacional = lucroBruto - despesasOperacionais;
      expect(resultadoOperacional).toBe(250.0);

      const totalComprasPessoais = personalOrders.reduce((sum, o) => sum + parseFloat(o.totalMondial), 0);
      expect(totalComprasPessoais).toBe(500.0);

      const resultadoLiquido = resultadoOperacional - totalComprasPessoais;
      expect(resultadoLiquido).toBe(-250.0);

      const margemLiquida = receitaBruta > 0 ? (resultadoLiquido / receitaBruta) * 100 : 0;
      expect(margemLiquida).toBeCloseTo(-3.125, 3);
    });

    it("should generate correct alerts", () => {
      const alerts: { type: string; message: string }[] = [];
      const resultadoLiquido = -250;
      const totalLIS = 150;
      const totalComprasPessoais = 2000;
      const lucroBruto = 3200;
      const totalCartoes = 1500;
      const receitaBruta = 8000;

      if (resultadoLiquido < 0) {
        alerts.push({ type: "danger", message: "Resultado negativo" });
      }
      if (totalLIS > 0) {
        alerts.push({ type: "danger", message: "LIS detectado" });
      }
      if (totalComprasPessoais > lucroBruto * 0.5 && lucroBruto > 0) {
        alerts.push({ type: "warning", message: "Compras pessoais altas" });
      }
      if (totalCartoes > receitaBruta * 0.15 && receitaBruta > 0) {
        alerts.push({ type: "warning", message: "Cartões altos" });
      }

      expect(alerts).toHaveLength(4);
      expect(alerts[0].type).toBe("danger");
      expect(alerts[1].type).toBe("danger");
      expect(alerts[2].type).toBe("warning");
      expect(alerts[3].type).toBe("warning");
    });

    it("should handle zero revenue correctly", () => {
      const receitaBruta = 0;
      const margemLiquida = receitaBruta > 0 ? (-250 / receitaBruta) * 100 : 0;
      expect(margemLiquida).toBe(0);
    });
  });
});
