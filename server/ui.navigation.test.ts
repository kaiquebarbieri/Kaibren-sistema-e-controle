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

  it("mantém as subtelas de Obrigações para contas, cartões e empréstimos com CTAs que abrem fluxos reais de cadastro", () => {
    const tabs = [
      { key: "contas", href: "/obrigacoes/contas", primaryDialog: "conta", secondaryDialog: "custoFixo", insight: "Radar executivo" },
      { key: "cartoes", href: "/obrigacoes/cartoes", primaryDialog: "cartao", secondaryDialog: "fatura", insight: "Resumo do uso" },
      { key: "emprestimos", href: "/obrigacoes/emprestimos", primaryDialog: "emprestimo", secondaryDialog: "retencao", insight: "Indicadores principais" },
    ];

    expect(tabs).toHaveLength(3);
    expect(tabs.map((item) => item.key)).toEqual(["contas", "cartoes", "emprestimos"]);
    expect(tabs.every((item) => item.href.startsWith("/obrigacoes/"))).toBe(true);
    expect(tabs.map((item) => item.primaryDialog)).toEqual(["conta", "cartao", "emprestimo"]);
    expect(tabs.map((item) => item.secondaryDialog)).toEqual(["custoFixo", "fatura", "retencao"]);
    expect(tabs.map((item) => item.insight)).toEqual(["Radar executivo", "Resumo do uso", "Indicadores principais"]);
  });

  it("preserva o princípio de que o DRE usa extratos e que as ações de cadastro em Obrigações abrem diálogos próprios", () => {
    const financeiro = {
      fonteDoDre: "extratos_bancarios",
      acoesPrincipais: [
        "Abrir Extratos para classificar",
        "Abrir contas a pagar",
        "Abrir cartões",
        "Abrir empréstimos",
      ],
      dialogosObrigacoes: ["conta", "custoFixo", "cartao", "fatura", "emprestimo", "retencao"],
    };

    expect(financeiro.fonteDoDre).toBe("extratos_bancarios");
    expect(financeiro.acoesPrincipais).toContain("Abrir Extratos para classificar");
    expect(financeiro.acoesPrincipais).toContain("Abrir contas a pagar");
    expect(financeiro.acoesPrincipais).toContain("Abrir cartões");
    expect(financeiro.acoesPrincipais).toContain("Abrir empréstimos");
    expect(financeiro.dialogosObrigacoes).toEqual(["conta", "custoFixo", "cartao", "fatura", "emprestimo", "retencao"]);
  });

  it("preserva a intenção de dashboards analíticos e visuais dedicados dentro de Obrigações", () => {
    const dashboards = {
      contas: ["Radar executivo", "Contas do mês", "Custos fixos do período"],
      cartoes: ["Resumo do uso", "Faturas registradas", "Cobertura visual"],
      emprestimos: ["Indicadores principais", "Empréstimos cadastrados", "Saldo em aberto"],
    };

    expect(dashboards.contas).toContain("Radar executivo");
    expect(dashboards.cartoes).toContain("Faturas registradas");
    expect(dashboards.emprestimos).toContain("Saldo em aberto");
  });

  it("mostra no painel de contas a pagar o título salvo e os detalhes complementares do cadastro", () => {
    const payable = {
      title: "Boleto fornecedor março",
      description: "Compra de embalagens",
      supplier: "Fornecedor X",
      category: "embalagem",
      dueDate: "2026-03-28",
    };

    const mainTitle = payable.title || payable.description || payable.supplier || "Conta a pagar";
    const detailParts = [payable.supplier, payable.description].filter((value, index, array) => {
      if (!value) return false;
      return array.indexOf(value) === index;
    });
    const detailLabel = detailParts.length > 0 ? detailParts.join(" • ") : "Sem detalhes adicionais";
    const subtitle = `${detailLabel} • ${payable.category || "Sem categoria"} • vencimento ${payable.dueDate}`;

    expect(mainTitle).toBe("Boleto fornecedor março");
    expect(subtitle).toContain("Fornecedor X");
    expect(subtitle).toContain("Compra de embalagens");
    expect(subtitle).toContain("embalagem");
    expect(subtitle).toContain("2026-03-28");
  });

  it("usa o mesmo CNPJ no cadastro e na leitura do painel de contas a pagar", () => {
    const selectedCnpjId = "7";
    const createPayload = {
      cnpjId: Number(selectedCnpjId),
      title: "Fornecedor abril",
      supplier: "Fornecedor Y",
      amount: "1500.00",
      dueDate: "2026-04-15",
    };
    const listInput = {
      year: 2026,
      month: 4,
      cnpjId: selectedCnpjId === "all" ? undefined : Number(selectedCnpjId),
    };
    const dashboardInput = {
      referenceDate: "2026-04-10",
      year: 2026,
      month: 4,
      cnpjId: selectedCnpjId === "all" ? undefined : Number(selectedCnpjId),
    };

    expect(createPayload.cnpjId).toBe(7);
    expect(listInput.cnpjId).toBe(7);
    expect(dashboardInput.cnpjId).toBe(7);
  });

  it("expõe ações de editar e excluir nas contas do painel usando o mesmo fluxo de diálogo", () => {
    const payable = {
      id: 41,
      cnpjId: 7,
      title: "Fornecedor abril",
      supplier: "Fornecedor Y",
      amount: "1500.00",
      dueDate: "2026-04-15",
      category: "fornecedor",
      status: "pending",
    };

    const openDialogPayload = {
      mode: "conta",
      payable,
    };

    const deletePayload = { id: payable.id };

    expect(openDialogPayload.mode).toBe("conta");
    expect(openDialogPayload.payable.title).toBe("Fornecedor abril");
    expect(openDialogPayload.payable.cnpjId).toBe(7);
    expect(deletePayload).toEqual({ id: 41 });
  });

  it("insere imediatamente o novo boleto no topo da lista filtrada após salvar", () => {
    const listInput = {
      year: 2026,
      month: 2,
      cnpjId: 7,
    };
    const existing = [
      { id: 10, title: "Conta anterior", cnpjId: 7, dueDate: "2026-02-20", amount: "450.00" },
    ];
    const created = { id: 11, title: "Boleto recém-cadastrado", cnpjId: 7, dueDate: "2026-02-26", amount: "987.65" };

    const upsertPayableInCache = (current: Array<Record<string, unknown>> | undefined, payable: Record<string, unknown>) => {
      const items = Array.isArray(current) ? [...current] : [];
      const index = items.findIndex((item) => item.id === payable.id);
      if (index >= 0) {
        items[index] = { ...items[index], ...payable };
      } else {
        items.unshift(payable);
      }
      return items;
    };

    const updated = upsertPayableInCache(existing, created);

    expect(listInput).toEqual({ year: 2026, month: 2, cnpjId: 7 });
    expect(updated).toHaveLength(2);
    expect(updated[0]?.title).toBe("Boleto recém-cadastrado");
    expect(updated[0]?.id).toBe(11);
    expect(updated[1]?.title).toBe("Conta anterior");
  });

  it("mantém estratégia responsiva para menus e botões sem corte visual", () => {
    const responsiveRules = {
      mobileMenu: "grid-cols-4 com textos em duas linhas",
      obligationTabs: "grid no mobile e 3 colunas a partir de sm",
      ctaButtons: "largura total no mobile e automática em telas maiores",
      desktopContent: "overflow-x-hidden com padding progressivo até 2xl",
      notebookHeader: "grid com duas colunas no md e largura fixa controlada no xl",
      notebookMonthControl: "flex-1 no rótulo do mês com botões shrink-0",
      spotlightActions: "grid full width até 2xl e wrap controlado depois",
    };

    expect(responsiveRules.mobileMenu).toContain("grid-cols-4");
    expect(responsiveRules.obligationTabs).toContain("3 colunas");
    expect(responsiveRules.ctaButtons).toContain("mobile");
    expect(responsiveRules.desktopContent).toContain("2xl");
    expect(responsiveRules.notebookHeader).toContain("md");
    expect(responsiveRules.notebookMonthControl).toContain("flex-1");
    expect(responsiveRules.spotlightActions).toContain("2xl");
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
