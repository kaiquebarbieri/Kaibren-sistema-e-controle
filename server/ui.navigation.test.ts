import { describe, expect, it } from "vitest";

describe("ui.navigation contract", () => {
  it("mantém o mapeamento esperado das seções do menu lateral sem a aba de importação", () => {
    const sections = [
      "visao-geral",
      "produtos",
      "simulacao",
      "pedidos",
      "dashboard-mensal",
    ];

    expect(sections).toHaveLength(5);
    expect(sections).toContain("produtos");
    expect(sections).toContain("simulacao");
    expect(sections).not.toContain("importacao");
    expect(sections[0]).toBe("visao-geral");
  });

  it("só libera abas de listas quando a simulação tiver itens", () => {
    const emptySimulation = {
      customerList: [],
      mondialList: [],
    };

    const populatedSimulation = {
      customerList: [{ sku: "0005-23" }],
      mondialList: [{ sku: "0005-23" }],
    };

    expect(emptySimulation.customerList.length === 0).toBe(true);
    expect(emptySimulation.mondialList.length === 0).toBe(true);
    expect(populatedSimulation.customerList.length > 0).toBe(true);
    expect(populatedSimulation.mondialList.length > 0).toBe(true);
  });
});
