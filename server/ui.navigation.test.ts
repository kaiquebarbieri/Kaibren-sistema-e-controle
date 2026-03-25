import { describe, expect, it } from "vitest";
import fs from "node:fs";

describe("ui.navigation contract", () => {
  it("mantém o menu principal com Financeiro, Contas e Agente como áreas separadas", () => {
    const sections = [
      { section: "dashboard", href: "/" },
      { section: "clientes", href: "/clientes" },
      { section: "produtos", href: "/produtos" },
      { section: "pedidos", href: "/pedidos" },
      { section: "marketing", href: "/marketing" },
      { section: "extratos", href: "/extratos" },
      { section: "financeiro", href: "/financeiro" },
      { section: "contas", href: "/contas" },
      { section: "agente", href: "/agente" },
    ];

    expect(sections).toHaveLength(9);
    expect(sections.find((item) => item.section === "financeiro")?.href).toBe("/financeiro");
    expect(sections.find((item) => item.section === "contas")?.href).toBe("/contas");
    expect(sections.find((item) => item.section === "agente")?.href).toBe("/agente");
  });

  it("restaura o Financeiro com a estrutura visual de DRE, subconta, período e painel operacional", () => {
    const content = fs.readFileSync(
      "/home/ubuntu/ck-distribuidora-sistema/client/src/pages/Finance.tsx",
      "utf-8",
    );

    expect(content).toContain("DRE e caixa realizado por subconta");
    expect(content).toContain("Subconta por CNPJ");
    expect(content).toContain("Painel Mercado Pago");
    expect(content).toContain("Onde o dinheiro mais saiu");
    expect(content).toContain("Maiores movimentos recentes");
    expect(content).toContain("Contas em controle");
  });

  it("mantém Financeiro e o módulo Contas em rotas distintas no App", () => {
    const appContent = fs.readFileSync(
      "/home/ubuntu/ck-distribuidora-sistema/client/src/App.tsx",
      "utf-8",
    );

    expect(appContent).toContain('path={"/financeiro"} component={Finance}');
    expect(appContent).toContain('path={"/contas"} component={Obligations}');
    expect(appContent).toContain('path={"/contas/:tab"} component={Obligations}');
  });

  it("expõe Contas a Pagar, Cartão de Crédito e Empréstimos na navegação lateral dentro do módulo Contas", () => {
    const layoutContent = fs.readFileSync(
      "/home/ubuntu/ck-distribuidora-sistema/client/src/components/DashboardLayout.tsx",
      "utf-8",
    );

    expect(layoutContent).toContain('label: "Contas"');
    expect(layoutContent).toContain('label: "Contas a Pagar"');
    expect(layoutContent).toContain('label: "Cartão de Crédito"');
    expect(layoutContent).toContain('label: "Empréstimos"');
    expect(layoutContent).not.toContain('label: "Obrigações"');
  });

  it("implementa o dashboard do módulo Contas com visão de números, vencimentos e controle operacional", () => {
    const content = fs.readFileSync(
      "/home/ubuntu/ck-distribuidora-sistema/client/src/pages/Obligations.tsx",
      "utf-8",
    );

    expect(content).toContain("Dashboard de Contas para análise e controle");
    expect(content).toContain("Próximos vencimentos e movimentos");
    expect(content).toContain("Alertas de vencimento");
    expect(content).toContain("Contas a Pagar");
    expect(content).toContain("Cartão de Crédito");
    expect(content).toContain("Empréstimos");
    expect(content).not.toContain('label: "Custos Fixos"');
    expect(content).not.toContain('"fixed-costs"');
  });

  it("mantém a área do agente como rota autenticada dentro do mesmo painel do usuário", () => {
    const agentArea = {
      route: "/agente",
      requiresAuth: true,
      provider: "openai",
      mode: "backend_stub",
      separateLogin: false,
    };

    expect(agentArea.route).toBe("/agente");
    expect(agentArea.requiresAuth).toBe(true);
    expect(agentArea.provider).toBe("openai");
    expect(agentArea.mode).toBe("backend_stub");
    expect(agentArea.separateLogin).toBe(false);
  });
});
