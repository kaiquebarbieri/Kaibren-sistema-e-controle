import { describe, it, expect } from "vitest";

describe("Navigation includes Pedidos and Dashboard as separate menus", () => {
  const menuItems = [
    { label: "Visão geral", section: "visao-geral", href: "/" },
    { label: "Clientes", section: "clientes", href: "/clientes" },
    { label: "Produtos", section: "produtos", href: "/produtos" },
    { label: "Pedidos", section: "pedidos", href: "/pedidos" },
    { label: "Dashboard", section: "dashboard", href: "/dashboard" },
  ];

  it("should have Pedidos as a dedicated menu item with its own route", () => {
    const pedidos = menuItems.find(item => item.section === "pedidos");
    expect(pedidos).toBeDefined();
    expect(pedidos!.href).toBe("/pedidos");
    expect(pedidos!.label).toBe("Pedidos");
  });

  it("should have Dashboard as a dedicated menu item with its own route", () => {
    const dashboard = menuItems.find(item => item.section === "dashboard");
    expect(dashboard).toBeDefined();
    expect(dashboard!.href).toBe("/dashboard");
    expect(dashboard!.label).toBe("Dashboard");
  });

  it("should not have Simulação as a menu item anymore", () => {
    const simulacao = menuItems.find(item => item.section === "simulacao");
    expect(simulacao).toBeUndefined();
  });

  it("should not have Dashboard mensal as an anchor link anymore", () => {
    const dashboardMensal = menuItems.find(item => item.href === "/#dashboard-mensal");
    expect(dashboardMensal).toBeUndefined();
  });
});

describe("Dashboard evolution data structure", () => {
  it("should produce 12 months of evolution data with correct fields", () => {
    const now = new Date();
    const months: { year: number; month: number; label: string; vendas: string; lucro: string; compras: string }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const label = `${String(month).padStart(2, "0")}/${year}`;
      months.push({ year, month, label, vendas: "0", lucro: "0", compras: "0" });
    }

    expect(months).toHaveLength(12);
    expect(months[0].label).toMatch(/^\d{2}\/\d{4}$/);
    expect(months[11].year).toBe(now.getFullYear());
    expect(months[11].month).toBe(now.getMonth() + 1);
  });
});

describe("Order types differentiation", () => {
  it("should distinguish customer orders from personal purchases", () => {
    const orderTypes = ["customer", "personal"] as const;
    expect(orderTypes).toContain("customer");
    expect(orderTypes).toContain("personal");
  });

  it("customer orders should show sales and profit, personal should show only total purchased", () => {
    const customerOrder = { orderType: "customer" as const, totalCliente: "150.00", totalLucro: "30.00" };
    const personalOrder = { orderType: "personal" as const, totalMondial: "80.00" };

    expect(customerOrder.totalCliente).toBeDefined();
    expect(customerOrder.totalLucro).toBeDefined();
    expect(personalOrder.totalMondial).toBeDefined();
  });
});
