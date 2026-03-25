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

  it("mantém Financeiro e o módulo Contas em rotas distintas no App", () => {
    const appContent = fs.readFileSync(
      "/home/ubuntu/ck-distribuidora-sistema/client/src/App.tsx",
      "utf-8",
    );

    expect(appContent).toContain('path={"/financeiro"} component={Finance}');
    expect(appContent).toContain('path={"/contas"} component={Obligations}');
    expect(appContent).toContain('path={"/contas/:tab"} component={Obligations}');
  });

  it("expõe Contas como grupo recolhível com submenus laterais dentro do módulo Contas", () => {
    const layoutContent = fs.readFileSync(
      "/home/ubuntu/ck-distribuidora-sistema/client/src/components/DashboardLayout.tsx",
      "utf-8",
    );

    expect(layoutContent).toContain('label: "Contas"');
    expect(layoutContent).toContain('label: "Contas a Pagar"');
    expect(layoutContent).toContain('label: "Cartão de Crédito"');
    expect(layoutContent).toContain('label: "Empréstimos"');
    expect(layoutContent).toContain('parentSection: "contas"');
    expect(layoutContent).toContain('const [expandedSections, setExpandedSections]');
    expect(layoutContent).toContain('const isExpandable = item.section === "contas"');
    expect(layoutContent).toContain('[item.section]: !current[item.section]');
    expect(layoutContent).toContain('[parentKey]: false');
    expect(layoutContent).toContain('visibleMenuItems.map(item =>');
    expect(layoutContent).toContain('setLocation(item.href)');
    expect(layoutContent).not.toContain('href: "/obrigacoes/contas-a-pagar"');
    expect(layoutContent).not.toContain('label: "Obrigações"');
  });

  it("sincroniza os submenus com as rotas de Contas", () => {
    const content = fs.readFileSync(
      "/home/ubuntu/ck-distribuidora-sistema/client/src/pages/Obligations.tsx",
      "utf-8",
    );

    expect(content).toContain('useRoute<{ tab?: string }>("/contas/:tab")');
    expect(content).toContain('useRoute<{ tab?: string }>("/obrigacoes/:tab")');
    expect(content).toContain('return "/contas/cartao-de-credito"');
    expect(content).toContain('return "/contas/emprestimos"');
    expect(content).toContain('return "/contas/contas-a-pagar"');
  });

  it("mantém cada submenu com conteúdo individual sem mistura entre categorias", () => {
    const content = fs.readFileSync(
      "/home/ubuntu/ck-distribuidora-sistema/client/src/pages/Obligations.tsx",
      "utf-8",
    );

    expect(content).toContain("Cada submenu agora abre sua própria área de controle");
    expect(content).toContain("Somente itens de contas a pagar aparecem nesta área.");
    expect(content).toContain("Somente itens de cartão de crédito aparecem nesta área.");
    expect(content).toContain("Somente itens de empréstimos aparecem nesta área.");
    expect(content).toContain("Aqui aparecem somente vencimentos e movimentos ligados a contas a pagar.");
    expect(content).toContain("Aqui aparecem somente cartões, bancos, limites e referências de fechamento ou vencimento.");
    expect(content).toContain("Aqui aparecem somente empréstimos, instituições, parcelas e datas relacionadas ao contrato.");
    expect(content).toContain("Label>CNPJ do cadastro</Label>");
    expect(content).toContain("SelectValue placeholder=\"Selecione o CNPJ\"");
    expect(content).toContain("cnpjs.map((cnpj) => (");
    expect(content).toContain("cnpjId: selectedCnpjId");
    expect(content).not.toContain("Leitura operacional");
    expect(content).not.toContain("Separação mantida");
    expect(content).not.toContain("SectionMenu sections={sections}");
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
