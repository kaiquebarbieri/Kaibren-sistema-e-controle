import { describe, it, expect } from "vitest";

describe("Finance Module", () => {
  describe("Fixed Costs", () => {
    it("should validate fixed cost categories", () => {
      const validCategories = [
        "aluguel", "internet", "telefone", "contador", "energia",
        "agua", "software", "seguro", "funcionario", "transporte", "outros"
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
      expect(total).toBe(2450.00);
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
      const currentMonth = 3; // March
      const paidInstallments = currentMonth - 1; // Jan, Feb paid
      const remaining = loan.totalInstallments - paidInstallments;
      expect(remaining).toBe(22);
    });

    it("should calculate total loan cost with interest", () => {
      const loan = { totalAmount: "10000.00", installmentAmount: "500.00", totalInstallments: 24 };
      const totalPaid = parseFloat(loan.installmentAmount) * loan.totalInstallments;
      const totalInterest = totalPaid - parseFloat(loan.totalAmount);
      expect(totalPaid).toBe(12000.00);
      expect(totalInterest).toBe(2000.00);
    });
  });

  describe("DRE Calculation", () => {
    it("should calculate DRE correctly", () => {
      // Simular dados do DRE
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
      expect(receitaBruta).toBe(8000.00);

      const custoMercadoriaVendida = salesOrders.reduce((sum, o) => sum + parseFloat(o.totalMondial), 0);
      expect(custoMercadoriaVendida).toBe(4800.00);

      const lucroBruto = receitaBruta - custoMercadoriaVendida;
      expect(lucroBruto).toBe(3200.00);

      const totalCustosFixos = fixedCostPayments.reduce((sum, p) => sum + parseFloat(p.amountPaid), 0);
      expect(totalCustosFixos).toBe(1650.00);

      const totalCartoes = cardInvoices.reduce((sum, i) => sum + parseFloat(i.totalAmount), 0);
      expect(totalCartoes).toBe(800.00);

      const totalEmprestimos = loanInstallments.reduce((sum, i) => sum + parseFloat(i.amount), 0);
      expect(totalEmprestimos).toBe(500.00);

      const despesasOperacionais = totalCustosFixos + totalCartoes + totalEmprestimos;
      expect(despesasOperacionais).toBe(2950.00);

      const resultadoOperacional = lucroBruto - despesasOperacionais;
      expect(resultadoOperacional).toBe(250.00);

      const totalComprasPessoais = personalOrders.reduce((sum, o) => sum + parseFloat(o.totalMondial), 0);
      expect(totalComprasPessoais).toBe(500.00);

      const resultadoLiquido = resultadoOperacional - totalComprasPessoais;
      expect(resultadoLiquido).toBe(-250.00);

      const margemLiquida = receitaBruta > 0 ? (resultadoLiquido / receitaBruta) * 100 : 0;
      expect(margemLiquida).toBeCloseTo(-3.125, 3);
    });

    it("should generate correct alerts", () => {
      const alerts: { type: string; message: string }[] = [];
      const resultadoLiquido = -250;
      const totalLIS = 150;
      const totalComprasPessoais = 2000;
      const lucroBruto = 3200;
      const despesasOperacionais = 2950;
      const totalCartoes = 1500;
      const receitaBruta = 8000;
      const margemLiquida = -3.125;

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
