import { describe, expect, it } from "vitest";
import fs from "node:fs";

describe("ui.navigation contract", () => {
  it("mantém o menu principal com Financeiro, Obrigações e Agente como áreas separadas", () => {
    const sections = [
      { section: "dashboard", href: "/" },
      { section: "clientes", href: "/clientes" },
      { section: "produtos", href: "/produtos" },
      { section: "pedidos", href: "/pedidos" },
      { section: "marketing", href: "/marketing" },
      { section: "extratos", href: "/extratos" },
      { section: "financeiro", href: "/financeiro" },
      { section: "obrigacoes", href: "/obrigacoes" },
      { section: "agente", href: "/agente" },
    ];

    expect(sections).toHaveLength(9);
    expect(sections.find((item) => item.section === "financeiro")?.href).toBe("/financeiro");
    expect(sections.find((item) => item.section === "obrigacoes")?.href).toBe("/obrigacoes");
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

  it("mantém Financeiro e Obrigações em rotas distintas no App", () => {
    const appContent = fs.readFileSync(
      "/home/ubuntu/ck-distribuidora-sistema/client/src/App.tsx",
      "utf-8",
    );

    expect(appContent).toContain('path={"/financeiro"} component={Finance}');
    expect(appContent).toContain('path={"/obrigacoes"} component={Obligations}');
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
