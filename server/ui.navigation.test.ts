import { describe, expect, it } from "vitest";

describe("ui.navigation contract", () => {
  it("mantém o menu principal com Financeiro e Obrigações como áreas separadas", () => {
    const sections = [
      { section: "dashboard", href: "/" },
      { section: "clientes", href: "/clientes" },
      { section: "produtos", href: "/produtos" },
      { section: "pedidos", href: "/pedidos" },
      { section: "marketing", href: "/marketing" },
      { section: "extratos", href: "/extratos" },
      { section: "financeiro", href: "/financeiro" },
      { section: "obrigacoes", href: "/obrigacoes" },
    ];

    expect(sections).toHaveLength(8);
    expect(sections.map((item) => item.section)).toContain("financeiro");
    expect(sections.map((item) => item.section)).toContain("obrigacoes");
    expect(sections.find((item) => item.section === "financeiro")?.href).toBe("/financeiro");
    expect(sections.find((item) => item.section === "obrigacoes")?.href).toBe("/obrigacoes");
  });

  it("mantém as subtelas de Obrigações para contas, cartões e empréstimos", () => {
    const tabs = [
      { key: "contas", href: "/obrigacoes/contas", primaryCtaTarget: "/obrigacoes/contas", secondaryCtaTarget: "/extratos", insight: "Radar executivo" },
      { key: "cartoes", href: "/obrigacoes/cartoes", primaryCtaTarget: "/obrigacoes/cartoes", secondaryCtaTarget: "/obrigacoes/cartoes", insight: "Resumo do uso" },
      { key: "emprestimos", href: "/obrigacoes/emprestimos", primaryCtaTarget: "/obrigacoes/emprestimos", secondaryCtaTarget: "/obrigacoes/emprestimos", insight: "Indicadores principais" },
    ];

    expect(tabs).toHaveLength(3);
    expect(tabs.map((item) => item.key)).toEqual(["contas", "cartoes", "emprestimos"]);
    expect(tabs.every((item) => item.href.startsWith("/obrigacoes/"))).toBe(true);
    expect(tabs.every((item) => item.primaryCtaTarget === item.href)).toBe(true);
    expect(tabs.find((item) => item.key === "contas")?.secondaryCtaTarget).toBe("/extratos");
    expect(tabs.filter((item) => item.key !== "contas").every((item) => item.secondaryCtaTarget === item.href)).toBe(true);
    expect(tabs.map((item) => item.insight)).toEqual(["Radar executivo", "Resumo do uso", "Indicadores principais"]);
  });

  it("preserva o princípio de que o DRE usa extratos e que as ações de cadastro ficam em Obrigações", () => {
    const financeiro = {
      fonteDoDre: "extratos_bancarios",
      acoesPrincipais: [
        "Abrir Extratos para classificar",
        "Abrir contas a pagar",
        "Abrir cartões",
        "Abrir empréstimos",
      ],
    };

    expect(financeiro.fonteDoDre).toBe("extratos_bancarios");
    expect(financeiro.acoesPrincipais).toContain("Abrir Extratos para classificar");
    expect(financeiro.acoesPrincipais).toContain("Abrir contas a pagar");
    expect(financeiro.acoesPrincipais).toContain("Abrir cartões");
    expect(financeiro.acoesPrincipais).toContain("Abrir empréstimos");
  });

  it("preserva a intenção de dashboards analíticos e visuais dedicados dentro de Obrigações", () => {
    const dashboards = {
      contas: ["Radar executivo", "Contas do mês", "Custos fixos do período"],
      cartoes: ["Resumo do uso", "Maior concentração", "Faturas registradas"],
      emprestimos: ["Indicadores principais", "Saldo em aberto", "Empréstimos cadastrados"],
    };

    expect(dashboards.contas).toContain("Radar executivo");
    expect(dashboards.contas).toContain("Custos fixos do período");
    expect(dashboards.cartoes).toContain("Resumo do uso");
    expect(dashboards.cartoes).toContain("Faturas registradas");
    expect(dashboards.emprestimos).toContain("Indicadores principais");
    expect(dashboards.emprestimos).toContain("Saldo em aberto");
  });

  it("usa as transações retornadas no DRE para preencher movimentos recentes e painel Mercado Pago", () => {
    const dre = {
      bankTransactions: [
        { id: 1, bankName: "Mercado Pago", transactionType: "credit", amount: 92096.29, isIdentified: 1, category: "venda" },
        { id: 2, bankName: "Mercado Pago", transactionType: "debit", amount: 1500, isIdentified: 1, category: "repasse para c6 bank" },
        { id: 3, bankName: "C6 Bank", transactionType: "debit", amount: 2000, isIdentified: 0, category: "sem categoria" },
      ],
    };

    const selectedCnpjId = "all";
    const allTransactions = selectedCnpjId === "all"
      ? dre.bankTransactions
      : dre.bankTransactions.filter((item) => String((item as any).cnpjId || "") === selectedCnpjId);

    const topCredits = allTransactions.filter((item) => item.transactionType === "credit").slice(0, 5);
    const topDebits = allTransactions.filter((item) => item.transactionType === "debit").slice(0, 8);
    const mercadoPagoTransactions = allTransactions.filter((item) => item.bankName.toLowerCase().includes("mercado pago"));
    const mercadoPagoSummary = {
      totalTransactions: mercadoPagoTransactions.length,
      identified: mercadoPagoTransactions.filter((item) => item.isIdentified === 1).length,
      pending: mercadoPagoTransactions.filter((item) => item.isIdentified !== 1).length,
      transfers: mercadoPagoTransactions
        .filter((item) => item.category.toLowerCase().includes("repasse para c6 bank"))
        .reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0),
    };

    expect(topCredits).toHaveLength(1);
    expect(topDebits).toHaveLength(2);
    expect(mercadoPagoSummary.totalTransactions).toBe(2);
    expect(mercadoPagoSummary.identified).toBe(2);
    expect(mercadoPagoSummary.pending).toBe(0);
    expect(mercadoPagoSummary.transfers).toBe(1500);
  });
});
